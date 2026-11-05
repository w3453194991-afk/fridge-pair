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
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSel(1);
    this.refresh();
  },

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

    const pinned = S.state.pinned || [];
    list = list.slice().sort((a, b) => {
      const pa = pinned.indexOf(a.id) >= 0 ? 1 : 0;
      const pb = pinned.indexOf(b.id) >= 0 ? 1 : 0;
      return pb - pa;
    });

    const rows = list.slice(0, 90).map(d => {
      const ok = E.ingredientState(d, foods).every(s => s.ok);
      const mine = S.getDishPhoto(d.id);
      const isPin = pinned.indexOf(d.id) >= 0;
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        sub: d.ingredients.map(i => i.name).join(' + '),
        ok: ok,
        pinCls: isPin ? 'icobtn on' : 'icobtn',
        photo: mine || (P[d.id] ? ('/img/' + d.id + '.jpg') : ''),
        mineTag: mine ? '我的实拍' : '',
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

  onClear() {
    this.setData({ q: '' }, () => this.refresh());
  },

  onDish(e) {
    wx.navigateTo({ url: '/pages/dish/index?id=' + e.currentTarget.dataset.id });
  },

  onPin(e) {
    const id = e.currentTarget.dataset.id;
    S.togglePin(id);
    const on = (S.state.pinned || []).indexOf(id) >= 0;
    wx.showToast({ title: on ? '已置顶' : '已取消置顶', icon: 'none' });
    this.refresh();
  },

  onCover(e) {
    const id = e.currentTarget.dataset.id;
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const tmp = res.tempFiles[0].tempFilePath;
        try {
          wx.getFileSystemManager().saveFile({
            tempFilePath: tmp,
            success: (r) => {
              S.setDishPhoto(id, r.savedFilePath);
              wx.showToast({ title: '已设为封面', icon: 'none' });
              self.refresh();
            },
            fail: () => {
              S.setDishPhoto(id, tmp);
              self.refresh();
            }
          });
        } catch (err) {
          S.setDishPhoto(id, tmp);
          self.refresh();
        }
      },
      fail: () => {}
    });
  },

  onVideo() {
    wx.navigateTo({ url: '/pages/video/index' });
  }
});
