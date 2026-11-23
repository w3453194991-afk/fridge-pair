const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    advice: '',
    missing: [],
    listText: '',
    copied: false
  },

  onLoad() {
    let list = [];
    try {
      const missing = {};
      const week = S.state.week || [];
      week.slice(0, 3).forEach(day => {
        Object.keys(day.meals || {}).forEach(k => {
          const m = day.meals[k];
          (m.ids || []).forEach(id => {
            const dish = D.DISHES.filter(x => x.id === id)[0];
            if (!dish) return;
            E.ingredientState(dish, S.state.foods).forEach(s => {
              if (!s.ok) missing[s.name] = (missing[s.name] || 0) + 1;
            });
          });
        });
      });
      list = Object.keys(missing).sort((a, b) => missing[b] - missing[a]).slice(0, 8);
    } catch (e) {}

    const text = list.length ? list.join('、') : '';
    this.setData({
      missing: list,
      listText: text,
      advice: list.length ? ('共 ' + list.length + ' 样缺料') : '本周食材基本够用，暂时不用买'
    });
  },

  /* 复制采购清单 */
  onCopyList() {
    const text = this.data.listText;
    if (!text) {
      wx.showToast({ title: '暂时没有缺的食材', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: '要买：' + text,
      success: () => {
        wx.showToast({ title: '已复制，可粘贴给家人', icon: 'none' });
        this.setData({ copied: true });
      }
    });
  },

  /* 复制搜索关键词 */
  onCopyWords() {
    wx.setClipboardData({
      data: '超市 生鲜 菜市场',
      success: () => wx.showToast({ title: '已复制，去微信搜一搜', icon: 'none' })
    });
  },

  /* 回冰箱看看 */
  onBack() {
    wx.switchTab({ url: '/pages/fridge/index' });
  }
});
