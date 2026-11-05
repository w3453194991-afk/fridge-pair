const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: { tab: 'fit', q: '', list: [], counts: { fit: 0, all: 0 } },

  onShow() { this.refresh(); },

  refresh() {
    const foods = S.state.foods;
    let list = [];
    if (this.data.tab === 'fit') {
      list = E.cookable(foods);
    } else {
      list = D.DISHES.slice();
      const q = (this.data.q || '').trim();
      if (q) list = list.filter(d => d.name.indexOf(q) >= 0 || d.ingredients.some(i => i.name.indexOf(q) >= 0));
    }
    const rows = list.slice(0, 80).map(d => {
      const ok = E.ingredientState(d, foods).every(s => s.ok);
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        sub: d.ingredients.map(i => i.name).join(' + '),
        minutes: d.minutes,
        level: d.level,
        cuisine: (d.cuisine && d.cuisine[0]) || '家常',
        ok: ok
      };
    });
    this.setData({
      list: rows,
      counts: { fit: E.cookable(foods).length, all: D.DISHES.length }
    });
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab }, () => this.refresh());
  },

  onSearch(e) {
    this.setData({ q: e.detail.value, tab: 'all' }, () => this.refresh());
  },

  onDish(e) {
    wx.navigateTo({ url: '/pages/dish/index?id=' + e.currentTarget.dataset.id });
  }
});
