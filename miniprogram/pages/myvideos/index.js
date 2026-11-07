const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let CFG = {};
try { CFG = require('../../config.js') || {}; } catch (e) {}

const STATUS = {
  pending: { text: '审核中', cls: 'pending' },
  ok: { text: '已上架', cls: 'ok' },
  blocked: { text: '未通过', cls: 'blocked' },
  deleted: { text: '已删除', cls: 'deleted' }
};

Page({
  data: {
    loading: true,
    err: '',
    rows: []
  },

  onShow() {
    this.load();
  },

  load() {
    if (!wx.cloud || !CFG.CLOUD_ENV) {
      this.setData({ loading: false, err: '未配置云开发' });
      return;
    }
    const self = this;
    this.setData({ loading: true, err: '' });
    wx.cloud.callFunction({
      name: 'videos',
      data: { action: 'mine' },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          const raw = d.error || '读取失败';
          self.setData({
            loading: false,
            err: raw === '未知 action' ? '视频服务未部署，请先部署 cloudfunctions/videos' : raw,
            rows: []
          });
          return;
        }
        const reads = (S.state && S.state.videoReadAt) || {};
        const rows = (d.items || []).map(x => {
          const dish = D.DISHES.filter(y => y.id === x.dishId)[0];
          const st = STATUS[x.status] || STATUS.pending;
          const last = x.lastCommentAt || 0;
          const read = reads[x.dishId] || 0;
          return {
            id: x.id,
            dishId: x.dishId,
            name: (dish && dish.name) || x.dishName || '未知菜',
            emoji: (dish && dish.emoji) || '🍽',
            title: x.title || '',
            status: x.status,
            statusText: st.text,
            statusCls: st.cls,
            atText: self.fmtTime(x.at),
            canPlay: x.status === 'ok' || x.status === 'pending',
            unread: last > read,
            lastText: last ? ((x.lastCommentNick || '有人') + '：' + (x.lastCommentText || '')) : ''
          };
        });
        self.setData({ loading: false, rows: rows, hasUnread: rows.some(r => r.unread) });
      },
      fail: (e) => self.setData({ loading: false, err: '调用失败：' + ((e && e.errMsg) || '') })
    });
  },

  fmtTime(t) {
    if (!t) return '';
    const d = new Date(t);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  onOpen(e) {
    const i = Number(e.currentTarget.dataset.i);
    const it = this.data.rows[i];
    if (!it) return;
    wx.navigateTo({ url: '/pages/player/index?id=' + it.dishId });
  },

  onRemove(e) {
    const i = Number(e.currentTarget.dataset.i);
    const it = this.data.rows[i];
    if (!it) return;
    wx.showModal({
      title: '删除这个视频',
      content: '删除后其他人也看不到了。',
      confirmColor: '#B91C1C',
      success: (r) => {
        if (!r.confirm) return;
        wx.cloud.callFunction({
          name: 'videos',
          data: { action: 'remove', id: it.id },
          success: (res) => {
            const d = (res && res.result) || {};
            if (!d.ok) { wx.showToast({ title: d.error || '删除失败', icon: 'none' }); return; }
            wx.showToast({ title: '已删除', icon: 'none' });
            this.load();
          },
          fail: () => wx.showToast({ title: '删除失败', icon: 'none' })
        });
      }
    });
  },

  onAdd() {
    wx.switchTab({ url: '/pages/recipe/index' });
  },

  onBack() {
    wx.navigateBack();
  }
});
