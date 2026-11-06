const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

const CUISINES = ['家常', '川菜', '粤菜', '江浙', '鲁菜', '湘菜', '东北', '西北', '西餐', '日韩', '东南亚'];

Page({
  data: {
    men: 2,
    women: 2,
    kids: 1,
    total: 5,
    portions: '4.6',
    budget: '',
    wish: '',
    cuisine: '',
    cuisines: [],
    result: false,
    dishes: [],
    missing: [],
    cost: '0.0',
    over: false,
    droppedText: '',
    dateText: '',
    dishCount: 0
  },

  onLoad() {
    const now = new Date();
    const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
    this.setData({
      cuisines: CUISINES.map(c => ({ key: c, cls: 'chip' })),
      dateText: wk + ' ' + (now.getMonth() + 1) + '月' + now.getDate() + '日'
    });
    this.syncCount();
  },

  syncCount() {
    const { men, women, kids } = this.data;
    const total = men + women + kids;
    const portions = men * 1.2 + women * 1.0 + kids * 0.6;
    this.setData({
      total: total,
      portions: portions.toFixed(1)
    });
    return total;
  },

  onStep(e) {
    const k = e.currentTarget.dataset.k;
    const d = parseInt(e.currentTarget.dataset.d, 10);
    const cur = this.data[k] || 0;
    const next = Math.max(0, Math.min(20, cur + d));
    const obj = {};
    obj[k] = next;
    this.setData(obj, () => this.syncCount());
  },

  onBudget(e) { this.setData({ budget: e.detail.value }); },
  onWish(e) { this.setData({ wish: e.detail.value }); },

  onCuisine(e) {
    const key = e.currentTarget.dataset.key;
    const next = this.data.cuisine === key ? '' : key;
    this.setData({
      cuisine: next,
      cuisines: CUISINES.map(c => ({ key: c, cls: c === next ? 'chip on' : 'chip' }))
    });
  },

  onGen() {
    const total = this.syncCount();
    if (!total) {
      wx.showToast({ title: '至少要有 1 个人', icon: 'none' });
      return;
    }
    const budget = parseFloat(this.data.budget) || 0;

    // 库里没有的点名菜：自动生成一份菜谱并加入（这样能吃到"菜单外"的菜）
    const created = [];
    const wishNames = String(this.data.wish || '')
      .split(/[、,，;；\s+／/]+/).map(s => s.trim()).filter(Boolean).slice(0, 6)
      .map(s => (E.normalizeFoodName ? E.normalizeFoodName(s) : s));

    wishNames.forEach(nm => {
      const exists = D.DISHES.some(d =>
        d.name.indexOf(nm) >= 0 || nm.indexOf(d.name) >= 0 ||
        (d.tags || []).some(t => t.indexOf(nm) >= 0) ||
        (d.ingredients || []).some(i => i.name === nm)
      );
      if (exists || nm.length < 2) return;
      try {
        const isFood = (D.FOOD_DB || []).some(f => f.name === nm);
        const meta = E.foodMeta(nm);
        let dishName = nm;
        if (isFood) {
          if (meta.cat === '蔬菜' || meta.cat === '豆制品') dishName = '清炒' + nm;
          else if (meta.cat === '肉类' || meta.cat === '水产') dishName = '家常' + nm;
          else dishName = nm + '小食';
        }
        const draft = E.generateRecipe(dishName, isFood ? nm : undefined);
        if (!draft || !draft.name) return;
        if (D.DISHES.some(d => d.name === draft.name)) return;
        S.addCustom(draft);
        E.attachCustom([draft]);
        created.push(draft.name);
      } catch (e) {
        console.warn('[party] 自动生成菜谱失败', nm, e && e.message);
      }
    });

    let p = null;
    try {
      p = E.partyPlan(S.state, {
        men: this.data.men,
        women: this.data.women,
        kids: this.data.kids,
        cuisine: this.data.cuisine || '',
        dateLabel: this.data.dateText,
        wish: this.data.wish || '',
        taste: '',
        budget: budget,
        avoid: (S.state.family && S.state.family.avoid) || [],
        conditions: (S.state.family && S.state.family.conditions) || [],
        exclude: []
      });
    } catch (err) {
      wx.showModal({ title: '生成失败', content: String((err && err.message) || err), showCancel: false });
      return;
    }

    const dishes = (p.dishes || []).map(d => {
      const cost = (d.ingredients || []).reduce((s, i) => s + i.qty * (E.foodMeta(i.name).price || 0), 0);
      return {
        id: d.id, name: d.name, emoji: d.emoji, minutes: d.minutes,
        sub: (d.ingredients || []).map(i => i.name).join(' + '),
        cost: cost.toFixed(1)
      };
    });

    const missing = (p.missing || []).map(m => ({
      name: m.name,
      emoji: E.foodMeta(m.name).emoji,
      qty: (m.qty || 0) + (m.unit ? ' ' + m.unit : ''),
      cost: (m.cost || 0).toFixed(1),
      price: (E.foodMeta(m.name).price || 0)
    }));

    const wishHit = (p.wishHit || []).join('、');
    const wishMiss = (p.wishMiss || []).join('、');
    let wishText = '';
    if (created.length) wishText = '已为你想吃的菜新建菜谱：' + created.join('、');
    if (wishHit) wishText += (wishText ? '；' : '') + '已排进菜单：' + wishHit;
    if (wishMiss) wishText += (wishText ? '；' : '') + '菜谱库里没有：' + wishMiss;

    this.setData({
      result: true,
      dishes: dishes,
      dishCount: dishes.length,
      missing: missing,
      missingCount: missing.length,
      wishText: wishText,
      cost: (p.totalCost || 0).toFixed(1),
      over: !!p.overBudget,
      droppedText: (p.dropped && p.dropped.length) ? ('为控制预算已去掉：' + p.dropped.map(d => (d && d.name) || d).join('、')) : ''
    });
    wx.pageScrollTo({ scrollTop: 400, duration: 260 });
  },

  /* 把缺的料一次性加入采购清单 */
  onBuyMissing() {
    if (!this.data.missing.length) {
      wx.showToast({ title: '食材齐全，不用买', icon: 'none' });
      return;
    }
    try {
      S.addCart(this.data.missing.map(m => ({
        name: m.name,
        emoji: m.emoji,
        unit: '',
        qty: Math.max(1, Math.round(parseFloat(m.qty) || 1)),
        price: m.price || 0
      })));
      S.save();
    } catch (e) {
      wx.showModal({ title: '加入失败', content: String((e && e.message) || e), showCancel: false });
      return;
    }
    wx.showToast({ title: '已加入采购清单', icon: 'success' });
  },

  onDish(e) {
    wx.navigateTo({ url: '/pages/dish/index?id=' + e.currentTarget.dataset.id });
  },

  onCopy() {
    const lines = ['聚餐 ' + this.data.dateText + ' · ' + this.data.total + ' 人',
      '男士 ' + this.data.men + ' · 女士 ' + this.data.women + ' · 小孩 ' + this.data.kids];
    this.data.dishes.forEach(d => lines.push('· ' + d.name + '（约 ¥' + d.cost + '）'));
    if (this.data.missing.length) {
      lines.push('需要采购：');
      this.data.missing.forEach(m => lines.push('· ' + m.name + ' ¥' + m.cost));
    }
    lines.push('合计约 ¥' + this.data.cost);
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '菜单已复制', icon: 'none' })
    });
  }
});
