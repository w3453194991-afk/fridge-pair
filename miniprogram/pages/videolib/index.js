const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let CFG = {};
try { CFG = require('../../config.js') || {}; } catch (e) {}

Page({
  data: {
    loading: true,
    err: '',
    rows: [],
    keyword: ''
  },

  onShow() {
    this.load();
  },

  load() {
    if (!wx.cloud || !CFG.CLOUD_ENV) {
      this.setData({ loading: false, err: '未配置云开发，无法读取视频库' });
      return;
    }
    const self = this;
    this.setData({ loading: true, err: '' });
    wx.cloud.callFunction({
      name: 'videos',
      data: { action: 'dishes' },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          self.setData({ loading: false, err: d.error || '读取失败', rows: [] });
          return;
        }
        const rows = (d.items || []).map(x => {
          const dish = D.DISHES.filter(y => y.id === x.dishId)[0];
          return {
            dishId: x.dishId,
            name: (dish && dish.name) || x.dishName || '未知菜',
            emoji: (dish && dish.emoji) || '🍽',
            count: x.count || 1,
            nick: x.nick || '冰箱用户',
            atText: self.fmtTime(x.at)
          };
        });
        self.setData({ loading: false, rows: rows, err: rows.length ? '' : '' });
      },
      fail: (e) => {
        self.setData({ loading: false, err: '调用失败：' + ((e && e.errMsg) || '') });
      }
    });
  },

  fmtTime(t) {
    if (!t) return '';
    const d = new Date(t);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  },

  onOpen(e) {
    const i = Number(e.currentTarget.dataset.i);
    const it = this.data.rows[i];
    if (!it) return;
    wx.navigateTo({ url: '/pages/player/index?id=' + it.dishId });
  },

  onSearch() {
    wx.navigateTo({ url: '/pages/video/index' });
  },

  onBack() {
    wx.navigateBack();
  }
});
