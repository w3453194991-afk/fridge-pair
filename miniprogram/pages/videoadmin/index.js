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
    if (String(it.fileID).indexOf('cloud://') === 0 && wx.cloud) {
      wx.cloud.getTempFileURL({
        fileList: [it.fileID],
        success: (r) => {
          const f = (r.fileList || [])[0];
          if (f && f.tempFileURL) this.preview(f.tempFileURL);
          else wx.showToast({ title: '取不到视频地址', icon: 'none' });
        }
      });
    } else {
      this.preview(it.fileID);
    }
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
    wx.cloud.callFunction({
      name: 'videos',
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

  onBack() {
    wx.navigateBack();
  }
});
