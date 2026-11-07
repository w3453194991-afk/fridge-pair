const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let CONFIG = {};
try { CONFIG = require('../../config.js') || {}; } catch (e) {}

Page({
  data: {
    dish: null,
    src: '',
    loading: true,
    err: '',
    list: [],          // 共享库视频列表
    curIdx: 0,
    mine: false,
    curVideoId: '',

    /* 弹幕 */
    dms: [],           // 正在飘的 { k, text, top, mine }
    dmInput: '',
    dmAll: [],         // 全部弹幕（带时间点）

    /* 评论 */
    comments: [],
    cmInput: '',
    cmImages: [],
    replyTo: '',
    replyName: '',
    curTime: 0
  },

  onLoad(opt) {
    const id = (opt && opt.id) || '';
    this.dishId = id;
    const d = D.DISHES.filter(x => x.id === id)[0];
    this.setData({
      dish: d ? { name: d.name, emoji: d.emoji } : { name: '做法视频', emoji: '🎬' }
    });

    // 先看自己的（有就优先播）
    const own = d ? (d.videos || []).filter(v => typeof v === 'string' && v) : [];
    if (own.length) this.setSrc(own[0], true);

    this.loadShared();
  },

  /* 拉共享视频库 */
  loadShared() {
    if (!CONFIG.CLOUD_ENV || !wx.cloud) {
      this.setData({ loading: false, err: this.data.src ? '' : '未配置云开发，无法读取共享视频库' });
      return;
    }
    const self = this;
    wx.cloud.callFunction({
      name: 'videos',
      data: { action: 'list', dishId: this.dishId },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          self.setData({ loading: false, err: self.data.src ? '' : ('读取共享库失败：' + (d.error || '')) });
          return;
        }
        const list = (d.items || []).map((x, i) => ({
          idx: i,
          id: x.id,
          title: x.title || x.dishName || '做法视频',
          fileID: x.fileID,
          mine: !!x.mine,
          atText: self.fmtTime(x.at)
        }));
        self.setData({ list: list, loading: false, err: self.data.src || list.length ? '' : '' });

        // 自己没有视频时，自动播共享库第一条
        if (!self.data.src && list.length) {
          self.setData({ curIdx: 0, curVideoId: list[0].id });
          self.setSrc(list[0].fileID, list[0].mine, list[0].id);
          self.loadComments();
        }
      },
      fail: (e) => {
        self.setData({ loading: false, err: self.data.src ? '' : ('调用失败：' + ((e && e.errMsg) || '')) });
      }
    });
  },

  fmtTime(t) {
    if (!t) return '';
    const d = new Date(t);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  },

  /* 播放：优先让云函数代取链接（免费版存储是"仅创建者可读写"，自己取别人的会失败） */
  setSrc(fileOrUrl, mine, sharedId) {
    this.setData({ mine: !!mine });
    if (!fileOrUrl) return;

    if (!wx.cloud) {
      this.setData({ src: fileOrUrl, err: '' });
      return;
    }

    const done = (url, tip) => {
      if (url) this.setData({ src: url, err: '' });
      else this.setData({ err: tip || '取不到播放地址' });
    };

    // 共享库里的视频：用 id 走云函数
    if (sharedId) {
      wx.cloud.callFunction({
        name: 'videos',
        data: { action: 'play', id: sharedId },
        success: (res) => {
          const d = (res && res.result) || {};
          done(d.ok ? d.url : '', d.error || '云函数取链接失败');
        },
        fail: () => {
          // 云函数不可用时退回客户端直取（自己的视频可以）
          this.directUrl(fileOrUrl, done);
        }
      });
      return;
    }

    // 自己的视频：云函数换链接，失败再本地取
    wx.cloud.callFunction({
      name: 'videos',
      data: { action: 'url', fileID: fileOrUrl },
      success: (res) => {
        const d = (res && res.result) || {};
        if (d.ok && d.url) done(d.url);
        else this.directUrl(fileOrUrl, done);
      },
      fail: () => this.directUrl(fileOrUrl, done)
    });
  },

  directUrl(fileOrUrl, done) {
    if (String(fileOrUrl).indexOf('cloud://') !== 0) {
      done(fileOrUrl);
      return;
    }
    wx.cloud.getTempFileURL({
      fileList: [fileOrUrl],
      success: (r) => {
        const f = (r.fileList || [])[0];
        done(f && f.tempFileURL, '存储权限限制，只能看自己上传的视频');
      },
      fail: () => done('', '视频链接获取失败')
    });
  },

  onPick(e) {
    const i = Number(e.currentTarget.dataset.i);
    const it = this.data.list[i];
    if (!it) return;
    this.setData({ curIdx: i, curVideoId: it.id, comments: [], dmAll: [], dms: [] });
    this.setSrc(it.fileID, it.mine, it.id);
    this.loadComments();
  },

  onRemove(e) {
    const i = Number(e.currentTarget.dataset.i);
    const it = this.data.list[i];
    if (!it || !it.mine) return;
    wx.showModal({
      title: '删除这个视频',
      content: '删除后其他用户也看不到了。',
      confirmColor: '#B91C1C',
      success: (r) => {
        if (!r.confirm) return;
        wx.cloud.callFunction({
          name: 'videos',
          data: { action: 'remove', id: it.id },
          success: (res) => {
            const d = (res && res.result) || {};
            if (!d.ok) {
              wx.showToast({ title: d.error || '删除失败', icon: 'none' });
              return;
            }
            wx.showToast({ title: '已删除', icon: 'none' });
            this.setData({ src: '', list: [], curIdx: 0 }, () => this.loadShared());
          },
          fail: () => wx.showToast({ title: '删除失败', icon: 'none' })
        });
      }
    });
  },

  onError() {
    this.setData({ err: '这个视频打不开，可能是存储权限或链接过期' });
  },

  /* ================= 弹幕 ================= */
  onTime(e) {
    const t = Math.floor((e.detail && e.detail.currentTime) || 0);
    this.setData({ curTime: t });

    const all = this.data.dmAll || [];
    if (!all.length) return;
    const shown = this.data.dms || [];
    const now = Date.now();
    const fire = all.filter(d => Math.abs(d.t - t) <= 1 && !shown.some(s => s.id === d.id));
    if (!fire.length) return;

    const add = fire.slice(0, 3).map((d, i) => ({
      id: d.id,
      k: 'k' + now + i,
      text: d.text,
      top: 12 + (i % 4) * 46,
      mine: d.mine
    }));
    const next = shown.concat(add).slice(-8);
    this.setData({ dms: next });
    setTimeout(() => {
      const cur = (this.data.dms || []).filter(s => !add.some(a => a.k === s.k));
      this.setData({ dms: cur });
    }, 9000);
  },

  onDmInput(e) {
    this.setData({ dmInput: e.detail.value });
  },

  sendDm() {
    const text = String(this.data.dmInput || '').trim();
    if (!text) { wx.showToast({ title: '输入弹幕内容', icon: 'none' }); return; }
    this.post({ text: text, type: 'danmaku', t: this.data.curTime }, () => {
      this.setData({ dmInput: '' });
    });
  },

  /* ================= 评论 ================= */
  onCmInput(e) {
    this.setData({ cmInput: e.detail.value });
  },

  onPickImg() {
    const self = this;
    const left = 3 - (this.data.cmImages || []).length;
    if (left <= 0) { wx.showToast({ title: '最多 3 张', icon: 'none' }); return; }
    wx.chooseMedia({
      count: left,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = (res.tempFiles || []).map(f => f.tempFilePath);
        if (!paths.length) return;
        wx.showLoading({ title: '上传图片…', mask: true });
        let done = 0;
        const ids = [];
        paths.forEach((p, i) => {
          const ext = (p.match(/\.(\w+)$/) || [, 'jpg'])[1];
          wx.cloud.uploadFile({
            cloudPath: 'comment-imgs/' + Date.now() + '-' + i + '.' + ext,
            filePath: p,
            success: (r) => { ids.push(r.fileID); },
            complete: () => {
              done++;
              if (done === paths.length) {
                wx.hideLoading();
                self.setData({ cmImages: (self.data.cmImages || []).concat(ids) });
              }
            }
          });
        });
      }
    });
  },

  onRemoveImg(e) {
    const i = Number(e.currentTarget.dataset.i);
    const arr = this.data.cmImages.slice();
    arr.splice(i, 1);
    this.setData({ cmImages: arr });
  },

  onPreviewImg(e) {
    const { id, i } = e.currentTarget.dataset;
    const cm = this.data.comments.filter(c => c.id === id)[0];
    if (!cm) return;
    wx.previewImage({ current: cm.images[i], urls: cm.images });
  },

  onReply(e) {
    const { id, nick } = e.currentTarget.dataset;
    this.setData({ replyTo: id, replyName: nick || '' });
  },

  cancelReply() {
    this.setData({ replyTo: '', replyName: '' });
  },

  sendCm() {
    const text = String(this.data.cmInput || '').trim();
    const imgs = this.data.cmImages || [];
    if (!text && !imgs.length) { wx.showToast({ title: '写点内容', icon: 'none' }); return; }
    this.post({ text: text, images: imgs, type: 'comment', replyTo: this.data.replyTo }, () => {
      this.setData({ cmInput: '', cmImages: [], replyTo: '', replyName: '' });
    });
  },

  /* 统一提交：评论 / 弹幕 / 回复 */
  post(payload, done) {
    const vid = this.data.curVideoId;
    if (!vid) { wx.showToast({ title: '先选一个视频', icon: 'none' }); return; }
    const nick = (S.state.family && S.state.family.name) || '冰箱用户';
    wx.showLoading({ title: '发送中…', mask: true });
    wx.cloud.callFunction({
      name: 'comments',
      data: Object.assign({ action: 'add', videoId: vid, dishId: this.dishId, nick: nick }, payload),
      success: (res) => {
        wx.hideLoading();
        const d = (res && res.result) || {};
        if (!d.ok) {
          wx.showToast({ title: d.error || '发送失败', icon: 'none' });
          return;
        }
        wx.showToast({
          title: d.status === 'pending' ? '已提交，图片审核中' : '已发送',
          icon: 'none'
        });
        if (done) done();
        this.loadComments();
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '发送失败', icon: 'none' });
      }
    });
  },

  loadComments() {
    const vid = this.data.curVideoId;
    if (!vid || !wx.cloud) return;
    const self = this;
    wx.cloud.callFunction({
      name: 'comments',
      data: { action: 'list', videoId: vid },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) return;

        const raw = d.comments || [];
        const tops = raw.filter(x => !x.replyTo);
        const replies = raw.filter(x => x.replyTo);

        const comments = tops.map(c => {
          const rs = replies.filter(r => r.replyTo === c.id).map(r => ({
            id: r.id,
            nick: r.nick,
            text: r.text,
            atText: self.fmtTime(r.at)
          }));
          return {
            id: c.id,
            nick: c.nick,
            text: c.text,
            images: c.images || [],
            atText: self.fmtTime(c.at),
            replies: rs,
            mine: c.mine,
            pending: c.status === 'pending'
          };
        }).reverse();

        self.setData({ comments: comments, dmAll: d.danmaku || [] });
      }
    });
  },

  noop() {},

  onBack() {
    wx.navigateBack();
  }
});
