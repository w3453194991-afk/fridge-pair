const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let P = {};
try { P = require('../../lib/photos.js') || {}; } catch (e) { P = {}; }

Page({
  data: {
    tab: 'fit',
    tabs: [],
    q: '',
    fitRows: [],
    nearRows: [],
    allRows: [],
    pairRows: [],
    total: 0,
    cuisineCount: 0,
    fitCount: 0
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSel(1);
    this.render();
  },

  render() {
    const foods = S.state.foods;
    const tab = this.data.tab;
    const pinned = S.state.pinned || [];

    const tabs = [
      { key: 'fit', label: '用我的食材做' },
      { key: 'all', label: '全部菜谱' },
      { key: 'video', label: '视频做菜' },
      { key: 'pair', label: '相生相克' }
    ].map(t => ({ key: t.key, label: t.label, cls: t.key === tab ? 'chip on' : 'chip' }));

    const cookable = E.cookable(foods);
    const near = E.nearMiss(foods).slice(0, 6);

    const row = (d, extra) => {
      const ok = E.ingredientState(d, foods).every(s => s.ok);
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        sub: (d.ingredients || []).map(i => i.name).join(' + '),
        ok: ok,
        needText: (extra && extra.need) ? ('还差 ' + extra.need.emoji + ' ' + extra.need.name) : '',
        pinCls: pinned.indexOf(d.id) >= 0 ? 'rd-pin on' : 'rd-pin',
        m1: '⏱ ' + d.minutes + ' 分钟',
        m2: d.level,
        m3: (d.tags && d.tags[0]) || ''
      };
    };

    const fitRows = cookable.slice(0, 30).map(d => row(d));
    const nearRows = near.map(n => row(n.dish, n));

    // 全部：两列卡
    let list = D.DISHES.slice();
    const q = (this.data.q || '').trim();
    if (q) list = list.filter(d => d.name.indexOf(q) >= 0 || d.ingredients.some(i => i.name.indexOf(q) >= 0));
    list = list.slice().sort((a, b) => {
      const pa = pinned.indexOf(a.id) >= 0 ? 1 : 0;
      const pb = pinned.indexOf(b.id) >= 0 ? 1 : 0;
      return pb - pa;
    });
    const allRows = list.slice(0, 90).map(d => {
      const ok = E.ingredientState(d, foods).every(s => s.ok);
      const mine = S.getDishPhoto(d.id);
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        sub: (d.ingredients || []).map(i => i.name).join(' + '),
        ok: ok,
        pinCls: pinned.indexOf(d.id) >= 0 ? 'icobtn on' : 'icobtn',
        photo: mine || (P[d.id] ? ('/img/' + d.id + '.jpg') : ''),
        mineTag: mine ? '我的实拍' : '',
        m1: d.minutes + ' 分钟',
        m2: d.level
      };
    });

    // 相生相克
    let pairRows = [];
    try {
      pairRows = E.pairList(foods, false).slice(0, 30).map(p => ({
        a: p.a,
        b: p.b,
        why: p.why || '',
        tag: p.present ? '冰箱里有' : '建议搭配',
        cls: p.present ? 'ptag ok' : 'ptag'
      }));
    } catch (e) {}

    const cuisines = {};
    D.DISHES.forEach(d => { (d.cuisine || []).forEach(c => { cuisines[c] = 1; }); });

    this.setData({
      tabs: tabs,
      fitRows: fitRows,
      nearRows: nearRows,
      allRows: allRows,
      pairRows: pairRows,
      total: D.DISHES.length,
      cuisineCount: Object.keys(cuisines).length,
      fitCount: cookable.length
    });
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'video') {
      wx.navigateTo({ url: '/pages/video/index' });
      return;
    }
    this.setData({ tab: key }, () => this.render());
  },

  onSearch(e) {
    this.setData({ q: e.detail.value }, () => this.render());
  },

  onClear() {
    this.setData({ q: '' }, () => this.render());
  },

  onDish(e) {
    wx.navigateTo({ url: '/pages/dish/index?id=' + e.currentTarget.dataset.id });
  },

  onPin(e) {
    const id = e.currentTarget.dataset.id;
    S.togglePin(id);
    wx.showToast({ title: (S.state.pinned || []).indexOf(id) >= 0 ? '已置顶' : '已取消', icon: 'none' });
    this.render();
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
              self.render();
            },
            fail: () => { S.setDishPhoto(id, tmp); self.render(); }
          });
        } catch (err) { S.setDishPhoto(id, tmp); self.render(); }
      },
      fail: () => {}
    });
  },

  onAdd() {
    wx.showModal({
      title: '添加菜谱',
      editable: true,
      placeholderText: '输入想吃的菜，如：可乐鸡翅',
      success: (res) => {
        if (!res.confirm) return;
        const name = String(res.content || '').trim();
        if (!name) { wx.showToast({ title: '请输入菜名', icon: 'none' }); return; }
        try {
          const draft = E.generateRecipe(name);
          S.addCustom(draft);
          E.attachCustom([draft]);
          wx.showToast({ title: '已加入：' + name, icon: 'none' });
          this.setData({ tab: 'all' }, () => this.render());
        } catch (e) {
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      }
    });
  }
});
