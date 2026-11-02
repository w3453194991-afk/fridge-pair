/* ============================================================
   冰箱对对碰 · 状态与持久化
   ============================================================ */
(function (w) {
  'use strict';
  const D = w.DD_DATA;
  const E = w.DD_ENGINE;
  const KEY = 'fridge.ddm.v1';
  const DAY = 86400000;

  let uid = 1;
  function nid() { return 'f' + (Date.now().toString(36)) + (uid++).toString(36); }

  function makeFood(name, qty, daysToExpire, storageOverride) {
    const m = E.foodMeta(name);
    const t = Date.now();
    return {
      id: nid(),
      name: name,
      emoji: m.emoji,
      cat: m.cat,
      unit: m.unit,
      qty: qty,
      storage: storageOverride || m.storage || '冷藏',
      shelfDays: m.shelf,
      addedAt: t,
      expireAt: t + Math.round(daysToExpire * DAY)
    };
  }

  function seedState() {
    const foods = D.SEED.map(s => makeFood(s.name, s.qty, s.d)).filter(Boolean);
    // 给每件食材补上"入库时间"= 过期时间 - 标准保质期
    foods.forEach(f => {
      const shelf = Math.max(1, f.shelfDays || 7);
      f.addedAt = f.expireAt - shelf * DAY;
    });
    return {
      version: 1,
      createdAt: Date.now(),
      clockOffset: 0,
      family: {
        name: '林妈妈',
        members: [
          { role: '成人', age: 34 },
          { role: '老人', age: 68 },
          { role: '幼儿', age: 3 }
        ],
        taboos: ''
      },
      foods: foods,
      cart: [],
      week: null,
      party: null,
      stats: { cooked: 0, saved: 0, added: 0, trashed: 0 }
    };
  }

  const STORE = {
    state: null,

    load: function () {
      let s = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) s = JSON.parse(raw);
      } catch (e) { s = null; }
      if (!s || !s.foods || !Array.isArray(s.foods)) s = seedState();
      if (!s.stats) s.stats = { cooked: 0, saved: 0, added: 0, trashed: 0 };
      if (!Array.isArray(s.cart)) s.cart = [];
      this.state = s;
      return s;
    },

    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* file:// 下可能不可用 */ }
    },

    /* ---------- 食材 ---------- */
    add: function (name, qty, days, storage) {
      const f = makeFood(name, qty, days, storage);
      f.addedAt = Date.now();
      this.state.foods.push(f);
      this.state.stats.added = (this.state.stats.added || 0) + 1;
      this.save();
      return f;
    },

    get: function (id) {
      return this.state.foods.filter(f => f.id === id)[0] || null;
    },

    setQty: function (id, qty) {
      const f = this.get(id);
      if (!f) return;
      f.qty = Math.max(0, Math.round(qty * 100) / 100);
      if (f.qty <= 0) this.state.foods = this.state.foods.filter(x => x.id !== id);
      this.save();
    },

    consume: function (id, ratio) {
      // ratio: 消耗掉的比例（0~1）
      const f = this.get(id);
      if (!f) return { removed: false, left: 0 };
      const used = f.qty * ratio;
      const saved = (E.foodMeta(f.name).price || 0) * used;
      f.qty = Math.round((f.qty - used) * 100) / 100;
      const removed = f.qty <= 0.001;
      if (removed) {
        this.state.foods = this.state.foods.filter(x => x.id !== id);
        this.state.stats.saved = (this.state.stats.saved || 0) + saved;
      }
      this.save();
      return { removed: removed, left: removed ? 0 : f.qty, saved: saved };
    },

    trash: function (id) {
      const f = this.get(id);
      if (!f) return;
      this.state.foods = this.state.foods.filter(x => x.id !== id);
      this.state.stats.trashed = (this.state.stats.trashed || 0) + 1;
      this.save();
    },

    trashMany: function (ids) {
      const set = {};
      ids.forEach(i => { set[i] = 1; });
      const before = this.state.foods.length;
      this.state.foods = this.state.foods.filter(f => !set[f.id]);
      const n = before - this.state.foods.length;
      this.state.stats.trashed = (this.state.stats.trashed || 0) + n;
      this.save();
      return n;
    },

    keep: function (id, days) {
      const f = this.get(id);
      if (!f) return;
      f.expireAt = Date.now() + Math.round(days * DAY);
      this.save();
    },

    /* ---------- 购物车 ---------- */
    addCart: function (items) {
      items.forEach(it => {
        const ex = this.state.cart.filter(c => c.name === it.name)[0];
        if (ex) ex.qty = Math.round((ex.qty + it.qty) * 10) / 10;
        else this.state.cart.push({
          name: it.name, emoji: it.emoji, unit: it.unit,
          qty: Math.round(it.qty * 10) / 10, price: it.price || 0
        });
      });
      this.save();
    },
    clearCart: function () { this.state.cart = []; this.save(); },
    buyCart: function () {
      const n = this.state.cart.length;
      this.state.cart.forEach(c => {
        const m = E.foodMeta(c.name);
        this.add(c.name, Math.max(c.qty, 1), Math.max(1, m.shelf || 7), m.storage);
      });
      this.state.cart = [];
      this.save();
      return n;
    },

    /* ---------- 家庭 ---------- */
    saveFamily: function (fam) { this.state.family = fam; this.save(); },

    /* ---------- 演示：时间旅行 ---------- */
    travel: function (days) {
      this.state.clockOffset = (this.state.clockOffset || 0) + days * DAY;
      this.save();
      return this.state.clockOffset;
    },

    reset: function () {
      this.state = seedState();
      this.save();
    }
  };

  w.DD_STORE = STORE;
  w.DD_SEED = seedState;
})(window);
