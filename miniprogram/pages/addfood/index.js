const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

const DAY = 24 * 3600 * 1000;

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function ymd(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function todayYmd() { return ymd(Date.now()); }

const COMMON = ['番茄', '鸡蛋', '牛奶', '菠菜', '土豆', '洋葱', '胡萝卜', '青椒', '豆腐', '苹果', '猪肉', '鸡胸肉'];

Page({
  data: {
    name: '',
    qty: 1,
    unit: '份',
    shelf: 7,
    useDate: false,
    datePicker: '',
    minDate: '',
    maxDate: '',
    matched: null,
    suggest: [],
    common: COMMON,
    recent: []
  },

  onLoad() {
    const now = Date.now();
    this.setData({
      datePicker: ymd(now + 7 * DAY),
      minDate: todayYmd(),
      maxDate: ymd(now + 730 * DAY)
    });
    // 最近添加过的 6 样，方便复用
    const names = [];
    (S.state.foods || []).forEach(f => {
      if (names.indexOf(f.name) < 0) names.push(f.name);
    });
    this.setData({ recent: names.slice(0, 6) });
  },

  onName(e) {
    const v = e.detail.value;
    this.setData({ name: v });
    this.lookup(v);
  },

  lookup(v) {
    const q = String(v || '').trim();
    if (!q) {
      this.setData({ suggest: [], matched: null });
      return;
    }
    const db = D.FOOD_DB || [];
    const hit = db.filter(f => f.name === q)[0];
    const sug = db.filter(f => f.name.indexOf(q) >= 0).slice(0, 8).map(f => {
      const m = E.foodMeta(f.name);
      return { name: f.name, emoji: m.emoji, unit: m.unit, shelf: m.shelf };
    });

    if (hit) {
      const m = E.foodMeta(hit.name);
      this.setData({
        matched: { emoji: m.emoji, unit: m.unit, shelf: m.shelf, cat: hit.cat || '' },
        unit: m.unit || this.data.unit,
        shelf: m.shelf || this.data.shelf,
        suggest: sug
      });
    } else {
      this.setData({ matched: null, suggest: sug });
    }
  },

  onPickSuggest(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ name: name });
    this.lookup(name);
  },

  onQty(e) {
    const d = Number(e.currentTarget.dataset.d);
    this.setData({ qty: Math.max(1, Math.min(99, this.data.qty + d)) });
  },

  onQtyInput(e) {
    const v = parseInt(e.detail.value, 10);
    this.setData({ qty: isNaN(v) ? 1 : Math.max(1, Math.min(99, v)) });
  },

  onUnit(e) {
    this.setData({ unit: e.detail.value || '份' });
  },

  toggleDate() {
    this.setData({ useDate: !this.data.useDate });
  },

  onDate(e) {
    this.setData({ datePicker: e.detail.value });
  },

  quickShelf(e) {
    const d = Number(e.currentTarget.dataset.d);
    this.setData({ useDate: false, shelf: d });
  },

  onAdd() {
    const name = String(this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '先写个食材名称', icon: 'none' });
      return;
    }

    let days = Number(this.data.shelf) || 7;
    let expireAt = null;

    if (this.data.useDate) {
      const parts = String(this.data.datePicker).split('-');
      const end = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59).getTime();
      days = Math.max(0, Math.ceil((end - Date.now()) / DAY));
      expireAt = end;
    }

    const meta = E.foodMeta(name);
    try {
      const f = S.add(name, this.data.qty, days, meta.storage || '');
      if (expireAt && f) f.expireAt = expireAt;
      // 单位允许自定义
      if (f && this.data.unit) f.unit = this.data.unit;
      S.save();
    } catch (err) {
      wx.showModal({ title: '添加失败', content: String((err && err.message) || err), showCancel: false });
      return;
    }

    wx.showToast({ title: '已添加 ' + name, icon: 'success' });
    this.setData({ name: '', qty: 1, matched: null, suggest: [] });

    const names = [];
    (S.state.foods || []).forEach(x => { if (names.indexOf(x.name) < 0) names.push(x.name); });
    this.setData({ recent: names.slice(0, 6) });
  },

  onDone() {
    wx.navigateBack();
  }
});
