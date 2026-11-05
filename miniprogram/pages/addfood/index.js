const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    q: '',
    cat: 'all',
    cats: [],
    list: [],
    qtyMap: {},
    picked: 0
  },

  onLoad() {
    const db = D.FOOD_DB || [];
    const catSet = [];
    db.forEach(f => {
      const c = f.cat || '其他';
      if (catSet.indexOf(c) < 0) catSet.push(c);
    });

    const cats = [{ key: 'all', label: '全部' }].concat(
      catSet.map(c => ({ key: c, label: c }))
    );

    this.db = db;
    this.setData({ cats: cats });
    this.render();
  },

  render() {
    const q = (this.data.q || '').trim();
    const cat = this.data.cat;
    const qtyMap = this.data.qtyMap || {};

    let list = this.db || [];
    if (cat !== 'all') list = list.filter(f => (f.cat || '其他') === cat);
    if (q) list = list.filter(f => f.name.indexOf(q) >= 0);

    const rows = list.slice(0, 200).map(f => {
      const meta = E.foodMeta(f.name);
      const qty = qtyMap[f.name] || 1;
      const have = (S.state.foods || []).filter(x => x.name === f.name)[0];
      return {
        name: f.name,
        emoji: meta.emoji || f.emoji || '🍽',
        unit: meta.unit || f.unit || '份',
        cat: f.cat || '其他',
        shelf: f.shelf || meta.shelf || 7,
        qty: qty,
        have: have ? E.fmtQty(have.qty) + ' ' + (have.unit || '') : ''
      };
    });

    this.setData({
      list: rows,
      cats: this.data.cats.map(c => ({
        key: c.key,
        label: c.label,
        cls: c.key === cat ? 'chip on' : 'chip'
      })),
      picked: Object.keys(qtyMap).filter(k => qtyMap[k] > 0).length
    });
  },

  onSearch(e) {
    this.setData({ q: e.detail.value }, () => this.render());
  },

  onClear() {
    this.setData({ q: '' }, () => this.render());
  },

  onCat(e) {
    this.setData({ cat: e.currentTarget.dataset.key }, () => this.render());
  },

  onQty(e) {
    const name = e.currentTarget.dataset.name;
    const d = Number(e.currentTarget.dataset.d);
    const qtyMap = Object.assign({}, this.data.qtyMap);
    qtyMap[name] = Math.max(1, Math.min(30, (qtyMap[name] || 1) + d));
    this.setData({ qtyMap: qtyMap }, () => this.render());
  },

  onAdd(e) {
    const name = e.currentTarget.dataset.name;
    const qty = (this.data.qtyMap || {})[name] || 1;
    const meta = E.foodMeta(name);
    try {
      S.add(name, qty, meta.shelf || 7, meta.storage || '');
      S.save();
    } catch (err) {
      wx.showModal({ title: '添加失败', content: String((err && err.message) || err), showCancel: false });
      return;
    }
    wx.showToast({ title: '已添加 ' + name, icon: 'success' });
    this.render();
  },

  onDone() {
    wx.navigateBack();
  }
});
