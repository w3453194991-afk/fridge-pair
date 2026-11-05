const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

const CUISINES = ['家常', '川菜', '粤菜', '江浙', '鲁菜', '湘菜', '东北', '西北', '西餐', '日韩', '东南亚'];

Page({
  data: {
    people: 4,
    budget: '',
    wish: '',
    cuisine: '',
    cuisines: [],
    result: null,
    dishes: [],
    missing: [],
    total: 0,
    over: false,
    droppedText: '',
    dateText: ''
  },

  onLoad() {
    const now = new Date();
    const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
    this.setData({
      cuisines: CUISINES.map(c => ({ key: c, cls: 'chip' })),
      dateText: wk + ' ' + (now.getMonth() + 1) + '月' + now.getDate() + '日'
    });
  },

  onMinus() {
    if (this.data.people <= 1) return;
    this.setData({ people: this.data.people - 1 });
  },
  onPlus() {
    if (this.data.people >= 16) return;
    this.setData({ people: this.data.people + 1 });
  },
  onBudget(e) { this.setData({ budget: e.detail.value }); },
  onWish(e) { this.setData({ wish: e.detail.value }); },

  onCuisine(e) {
    const key = e.currentTarget.dataset.key;
    const next = this.data.cuisine === key ? '' : key;
    const cuisines = CUISINES.map(c => ({ key: c, cls: c === next ? 'chip on' : 'chip' }));
    this.setData({ cuisine: next, cuisines: cuisines });
  },

  onGen() {
    const n = this.data.people;
    const men = Math.ceil(n / 2);
    const women = n - men;
    const budget = parseFloat(this.data.budget) || 0;
    let p = null;
    try {
      p = E.partyPlan(S.state, {
        men: men,
        women: women,
        kids: 0,
        cuisine: this.data.cuisine || '',
        dateLabel: this.data.dateText,
        wish: this.data.wish || '',
        taste: '',
        budget: budget,
        avoid: (S.state.family && S.state.family.avoid) || [],
        conditions: (S.state.family && S.state.family.conditions) || [],
        exclude: []
      });
    } catch (e) {
      wx.showToast({ title: '生成失败：' + ((e && e.message) || e), icon: 'none' });
      return;
    }

    const dishes = (p.dishes || []).map(d => {
      const cost = (d.ingredients || []).reduce((s, i) => s + i.qty * (E.foodMeta(i.name).price || 0), 0);
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        minutes: d.minutes,
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
      missing: missing,
      total: (p.totalCost || 0).toFixed(1),
      over: !!p.overBudget,
      droppedText: (p.dropped && p.dropped.length) ? ('为控制预算已去掉：' + p.dropped.join('、')) : ''
    });
  },

  onDish(e) {
    wx.navigateTo({ url: '/pages/dish/index?id=' + e.currentTarget.dataset.id });
  },

  onCopy() {
    const lines = [];
    lines.push('聚餐 ' + this.data.dateText + ' · ' + this.data.people + ' 人');
    this.data.dishes.forEach(d => lines.push('· ' + d.name + '（约 ¥' + d.cost + '）'));
    if (this.data.missing.length) {
      lines.push('需要采购：');
      this.data.missing.forEach(m => lines.push('· ' + m.name + ' ¥' + m.cost));
    }
    lines.push('合计约 ¥' + this.data.total);
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '菜单已复制', icon: 'none' })
    });
  }
});
