const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    tab: 'pending',
    rows: [],
    loading: true,
    err: '',
    isAdmin: false
  },

  onShow() {
    this.load(this.data.tab);
  },

  onTab(e) {
    const t = e.currentTarget.dataset.tab;
    this.setData({ tab: t }, () => this.load(t));
  },

  load(tab) {
    if (tab === 'images') return this.loadImages();
    if (tab === 'dishes') return this.loadDishes();
    if (tab === 'photos') return this.loadPhotos();
    if (!wx.cloud) {
      this.setData({ loading: false, err: '未配置云开发' });
      return;
    }
    const self = this;
    this.setData({ loading: true, err: '' });
    wx.cloud.callFunction({
      name: 'videos',
      data: { action: tab === 'pending' ? 'pending' : 'all' },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          self.setData({ loading: false, err: d.error || '读取失败', rows: [] });
          return;
        }
        const rows = (d.items || []).map(x => ({
          id: x.id,
          title: x.title || x.dishName || '未命名',
          dishName: x.dishName,
          fileID: x.fileID,
          status: x.status,
          statusText: { pending: '待审核', ok: '已上架', blocked: '已驳回', deleted: '已删除' }[x.status] || x.status,
          atText: self.fmtTime(x.at)
        }));
        self.setData({ loading: false, rows: rows, isAdmin: true });
      },
      fail: (e) => {
        self.setData({ loading: false, err: '调用失败：' + ((e && e.errMsg) || '') });
      }
    });
  },

  /* 共享菜谱审核 */
  loadDishes() {
    if (!wx.cloud) { this.setData({ loading: false, err: '未配置云开发' }); return; }
    const self = this;
    this.setData({ loading: true, err: '' });
    wx.cloud.callFunction({
      name: 'sharedDishes',
      data: { action: 'pending' },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          const raw = d.error || '读取失败';
          self.setData({
            loading: false,
            err: raw === '未知 action' ? '共享菜谱服务未部署' : raw,
            rows: []
          });
          return;
        }
        const rows = (d.items || []).map(x => ({
          id: x.id,
          title: x.name,
          dishName: (x.cuisine || []).join(' / ') || '家常',
          status: x.status,
          statusText: '待审核',
          atText: self.fmtTime(x.at),
          isDish: true,
          steps: (x.steps || []).length,
          ings: (x.ingredients || []).map(i => i.name).join('、')
        }));
        self.setData({ loading: false, rows: rows });
      },
      fail: (e) => self.setData({ loading: false, err: '调用失败：' + ((e && e.errMsg) || '') })
    });
  },

  /* 菜品实拍图审核 */
  loadPhotos() {
    if (!wx.cloud) { this.setData({ loading: false, err: '未配置云开发' }); return; }
    const self = this;
    this.setData({ loading: true, err: '' });
    wx.cloud.callFunction({
      name: 'gallery',
      data: { action: 'pending' },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          const raw = d.error || '读取失败';
          self.setData({
            loading: false,
            err: raw === '未知 action' ? '实拍图服务未部署（cloudfunctions/gallery）' : raw,
            rows: []
          });
          return;
        }
        const rows = (d.items || []).map(x => ({
          id: x.id,
          title: x.dishName || '菜品实拍',
          dishName: x.nick || '冰箱用户',
          images: [x.fileID],
          status: x.status,
          statusText: '待审核',
          atText: self.fmtTime(x.at),
          isPhoto: true
        }));
        self.setData({ loading: false, rows: rows });
      },
      fail: (e) => self.setData({ loading: false, err: '调用失败：' + ((e && e.errMsg) || '') })
    });
  },

  /* 评论图片审核 */
  loadImages() {
    if (!wx.cloud) { this.setData({ loading: false, err: '未配置云开发' }); return; }
    const self = this;
    this.setData({ loading: true, err: '' });
    wx.cloud.callFunction({
      name: 'comments',
      data: { action: 'pendingImages' },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          self.setData({ loading: false, err: d.error || '读取失败', rows: [] });
          return;
        }
        const rows = (d.items || []).map(x => ({
          id: x.id,
          title: x.text || '（仅图片）',
          dishName: x.nick,
          images: x.images || [],
          status: x.status,
          statusText: '待审核',
          atText: self.fmtTime(x.at),
          isImage: true
        }));
        self.setData({ loading: false, rows: rows });
      },
      fail: (e) => {
        self.setData({ loading: false, err: '调用失败：' + ((e && e.errMsg) || '') });
      }
    });
  },

  onPreviewCmImg(e) {
    const { id, i } = e.currentTarget.dataset;
    const row = this.data.rows.filter(r => r.id === id)[0];
    if (!row || !row.images.length) return;

    const imgs = row.images;
    if (String(imgs[i]).indexOf('cloud://') !== 0) {
      wx.previewImage({ current: imgs[i], urls: imgs });
      return;
    }
    wx.showLoading({ title: '打开中…', mask: true });
    wx.cloud.getTempFileURL({
      fileList: imgs,
      success: (r) => {
        wx.hideLoading();
        const urls = (r.fileList || []).map(f => f.tempFileURL).filter(Boolean);
        if (!urls.length) { wx.showToast({ title: '图片读取失败', icon: 'none' }); return; }
        const cur = urls[Math.min(i, urls.length - 1)];
        wx.previewImage({ current: cur, urls: urls });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '图片读取失败', icon: 'none' });
      }
    });
  },

  fmtTime(t) {
    if (!t) return '';
    const d = new Date(t);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  onPlay(e) {
    const i = Number(e.currentTarget.dataset.i);
    const it = this.data.rows[i];
    if (!it) return;
    // 云函数代取链接（免费版存储仅创建者可读）
    wx.cloud.callFunction({
      name: 'videos',
      data: { action: 'play', id: it.id },
      success: (res) => {
        const d = (res && res.result) || {};
        if (d.ok && d.url) this.preview(d.url);
        else wx.showToast({ title: d.error || '取不到视频地址', icon: 'none' });
      },
      fail: () => wx.showToast({ title: '预览失败', icon: 'none' })
    });
  },

  preview(url) {
    wx.previewMedia({ sources: [{ url: url, type: 'video' }] }).catch(() => {
      wx.showToast({ title: '预览失败', icon: 'none' });
    });
  },

  onApprove(e) {
    this.act(e, 'approve', '已通过');
  },

  onBlock(e) {
    this.act(e, 'block', '已驳回');
  },

  act(e, action, okText) {
    const i = Number(e.currentTarget.dataset.i);
    const it = this.data.rows[i];
    if (!it) return;
    // 按来源选云函数
    const fn = it.isDish ? 'sharedDishes' : (it.isPhoto ? 'gallery' : (it.isImage ? 'comments' : 'videos'));
    wx.cloud.callFunction({
      name: fn,
      data: { action: action, id: it.id },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          wx.showToast({ title: d.error || '操作失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: okText, icon: 'none' });
        this.load(this.data.tab);
      },
      fail: () => wx.showToast({ title: '操作失败', icon: 'none' })
    });
  },

  /* 诊断：带真实用户身份跑一遍管理员判定 */
  onDiag() {
    if (!wx.cloud) { wx.showToast({ title: '未配置云开发', icon: 'none' }); return; }
    wx.showLoading({ title: '诊断中…', mask: true });
    const self = this;
    wx.cloud.callFunction({
      name: 'comments',
      data: { action: 'diag' },
      success: (res) => {
        wx.hideLoading();
        const d = (res && res.result) || {};
        if (!d.ok) {
          wx.showModal({
            title: '诊断失败',
            content: 'comments 云函数可能还是旧版本：\n' + (d.error || '未知错误') + '\n\n请先部署 cloudfunctions/comments',
            showCancel: false
          });
          return;
        }
        const v = d.videosWhoami || {};
        const lines = [
          '你的 openid：' + (d.openid || '(空)'),
          '',
          'comments 自己配的管理员数：' + (d.selfAdminCount || 0),
          'comments 自认管理员：' + (d.selfIsAdmin ? '是' : '否'),
          '',
          'videos 返回：' + (v.error ? ('调用失败 ' + v.error) : ('isAdmin=' + (v.isAdmin ? '是' : '否') + '，管理员数=' + (v.adminCount || 0) + (v.source ? '，来源=' + v.source : ''))),
          (v.adminLens && v.adminLens.length) ? ('名单长度：' + v.adminLens.join('、') + '（你的长度 ' + (v.openidLen || 0) + '）') : '',
          (v.adminHeads && v.adminHeads.length) ? ('名单开头：' + v.adminHeads.join('、')) : '',
          '',
          'users 记录：' + (v.userFound === undefined ? '(旧版videos，读不到)' : (v.userFound ? '已找到' : ('未找到，库里有 ' + (v.userTotal || 0) + ' 条'))),
          'users.isAdmin 标记：' + (v.userFound === undefined ? '(旧版videos)' : (v.userFlag === null ? '无此字段' : (v.userFlag ? 'true' : 'false'))),
          (v.userSample && v.userSample.length) ? ('库里 openid 样本：' + v.userSample.map(s => s.key + '=' + s.val).join('；')) : '',
          v.userErr ? ('查询出错：' + v.userErr) : '',
          '',
          '最终判定：' + (d.finalIsAdmin ? '✅ 是管理员' : '❌ 不是管理员')
        ].filter(Boolean);
        wx.showModal({
          title: '权限诊断',
          content: lines.join('\n'),
          showCancel: false,
          confirmText: '知道了'
        });
      },
      fail: (e) => {
        wx.hideLoading();
        wx.showModal({ title: '调用失败', content: String((e && e.errMsg) || ''), showCancel: false });
      }
    });
  },

  onBack() {
    wx.navigateBack();
  }
});
