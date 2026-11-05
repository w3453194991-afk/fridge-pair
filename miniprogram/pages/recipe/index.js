const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let P = {};
try { P = require('../../lib/photos.js') || {}; } catch (e) { P = {}; }

Page({
  data: {
    tab: 'fit',
    q: '',
    list: [],
    fitCount: 0,
    allCount: 0,
    fitCls: 'chip on',
    allCls: 'chip'
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSel(1); this.refresh(); },

  refresh() {
    const foods = S.state.foods;
    const tab = this.data.tab;
    let list = [];

    if (tab === 'fit') {
      list = E.cookable(foods);
    } else {
      list = D.DISHES.slice();
      const q = (this.data.q || '').trim();
      if (q) {
        list = list.filter(d => d.name.indexOf(q) >= 0 || d.ingredients.some(i => i.name.indexOf(q) >= 0));
      }
    }

    const rows = list.slice(0, 90).map(d => {
      const ok = E.ingredientState(d, foods).every(s => s.ok);
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        sub: d.ingredients.map(i => i.name).join(' + '),
        ok: ok,
        photo: P[d.id] ? ('/img/' + d.id + '.jpg') : '',
        m1: d.minutes + ' 分钟',
        m2: d.level
      };
    });

    this.setData({
      list: rows,
      fitCount: E.cookable(foods).length,
      allCount: D.DISHES.length,
      fitCls: tab === 'fit' ? 'chip on' : 'chip',
      allCls: tab === 'all' ? 'chip on' : 'chip'
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
