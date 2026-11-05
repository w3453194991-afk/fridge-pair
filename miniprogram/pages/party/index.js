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
      cost: (m.cost || 0).toFixed(1)
    }));

    this.setData({
      result: true,
      dishes: dishes,
      dishCount: dishes.length,
      missing: missing,
      cost: (p.totalCost || 0).toFixed(1),
      over: !!p.overBudget,
      droppedText: (p.dropped && p.dropped.length) ? ('为控制预算已去掉：' + p.dropped.join('、')) : ''
    });
    wx.pageScrollTo({ scrollTop: 400, duration: 260 });
  },

  onDish(e) {
    wx.navigateTo({ url: '/pages/dish/index?id=' + e.currentTarget.dataset.id });
  },

  onCopy() {
    const lines = ['聚餐 ' + this.data.dateText + ' · ' + this.data.total + ' 人',
      '男 ' + this.data.men + ' · 女 ' + this.data.women + ' · 小孩 ' + this.data.kids];
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
