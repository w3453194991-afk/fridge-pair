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
    mine: false
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
          self.setData({ curIdx: 0 });
          self.setSrc(list[0].fileID, false);
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

  /* cloud:// 换临时链接后播放 */
  setSrc(fileOrUrl, mine) {
    this.setData({ mine: !!mine });
    if (!fileOrUrl) return;
    if (String(fileOrUrl).indexOf('cloud://') === 0 && wx.cloud) {
      wx.cloud.getTempFileURL({
        fileList: [fileOrUrl],
        success: (r) => {
          const f = (r.fileList || [])[0];
          if (f && f.tempFileURL) this.setData({ src: f.tempFileURL, err: '' });
          else this.setData({ err: '视频链接获取失败' });
        },
        fail: () => this.setData({ err: '云存储读取失败，检查存储权限是否为「所有用户可读」' })
      });
    } else {
      this.setData({ src: fileOrUrl, err: '' });
    }
  },

  onPick(e) {
    const i = Number(e.currentTarget.dataset.i);
    const it = this.data.list[i];
    if (!it) return;
    this.setData({ curIdx: i });
    this.setSrc(it.fileID, it.mine);
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

  onBack() {
    wx.navigateBack();
  }
});
