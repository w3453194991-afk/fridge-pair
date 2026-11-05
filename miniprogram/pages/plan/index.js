const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

const RULE = {
  '老人': '补钙 · 少盐 · 炖软烂',
  '幼儿': '少盐 · 切小块 · 易嚼',
  '成人': '控油 · 多蔬菜 · 控糖'
};
const ICON = { '老人': '👵', '幼儿': '👶', '成人': '👨' };

Page({
  data: {
    famName: '',
    memberChips: [],
    avoidText: '',
    condText: '',
    systems: [],
    sysName: '',
    sysDesc: '',
    sysStripe: '',
    advice: [],
    hasMenu: false,
    days: [],
    nutBars: [],
    todayLabel: '',
    cart: [],
    cartCount: 0,
    cartTotal: '0.0'
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSel(2);
    this.render();
  },

  render() {
    const st = S.state;
    const fam = st.family;
    const sysKey = fam.system || 'cn';
    const sys = D.SYSTEM_MAP[sysKey] || D.MEAL_SYSTEMS[0];

    const memberChips = (fam.members || []).map(m => ({
      icon: m.role === '幼儿' ? '👶' : m.role === '老人' ? '👵' : '👨',
      text: m.role + ' ' + m.age + ' 岁'
    }));

    const advice = (fam.members || []).map(m => ({
      icon: ICON[m.role] || '👨',
      label: m.role + ' ' + m.age + ' 岁',
      rule: RULE[m.role] || RULE['成人']
    }));

    const systems = D.MEAL_SYSTEMS.map(s => ({
      key: s.key,
      label: s.emoji + ' ' + s.name,
      cls: s.key === sysKey ? 'chip on' : 'chip'
    }));

    // 菜单
    const week = st.week || [];
    const days = week.map(d => {
      const meals = [];
      ['早', '午', '晚'].forEach(slot => {
        const m = d.meals && d.meals[slot];
        if (!m || !m.ids || !m.ids.length) return;
        const names = m.ids.map(id => {
          const x = D.DISHES.filter(y => y.id === id)[0];
          return x ? x.emoji + ' ' + x.name : '';
        }).filter(Boolean);
        meals.push({ slot: slot, names: names.join('、'), miss: !!m.missing });
      });
      return { label: d.label, meals: meals };
    });

    // 营养条
    let nutBars = [];
    let todayLabel = '';
    if (week.length) {
      const day = week[0];
      todayLabel = day.label || '今天';
      const m = (day.meals && (day.meals['午'] || day.meals['晚'] || day.meals['早'])) || null;
      if (m && m.ids && m.ids.length) {
        const dishes = m.ids.map(id => D.DISHES.filter(x => x.id === id)[0]).filter(Boolean);
        try {
          const totals = E.dayNutrition(dishes);
          const target = E.perMealTarget(fam);
          nutBars = E.nutritionBars(totals, target).map(b => {
            const over = b.pct > 130;
            const good = b.pct >= 90 && b.pct <= 130;
            const near = b.pct >= 60 && b.pct < 90;
            return {
              label: b.label,
              got: b.got,
              need: Math.round(b.need),
              unit: b.unit,
              pct: Math.min(100, Math.round(b.pct)),
              tag: over ? '偏高' : good ? '达标' : near ? '接近' : '偏低',
              color: over ? '#E0A00B' : good ? '#16A34A' : near ? '#F0A020' : '#FF5C7A'
            };
          });
        } catch (e) {}
      }
    }

    // 采购清单（购物车）
    const cart = (st.cart || []).map((c, i) => {
      const meta = E.foodMeta(c.name);
      const cost = (c.qty || 0) * (meta.price || 0);
      return {
        idx: i,
        name: c.name,
        emoji: c.emoji || meta.emoji,
        qty: E.fmtQty(c.qty) + ' ' + (c.unit || meta.unit),
        cost: cost.toFixed(1)
      };
    });
    const cartTotal = cart.reduce((s, x) => s + parseFloat(x.cost), 0).toFixed(1);

    this.setData({
      famName: fam.name || '我',
      memberChips: memberChips,
      avoidText: (fam.avoid || []).length ? fam.avoid.join(' · ') : '',
      condText: (fam.conditions || []).length ? fam.conditions.join(' · ') : '',
      systems: systems,
      sysName: sys ? sys.name : '中式',
      sysDesc: sys ? (sys.desc || '') : '',
      sysStripe: sys ? ('早：' + (sys.slots['早'] || []).join(' + ') + '　午：' + (sys.slots['午'] || []).join(' + ') + '　晚：' + (sys.slots['晚'] || []).join(' + ')) : '',
      advice: advice,
      hasMenu: days.length > 0,
      days: days,
      nutBars: nutBars,
      todayLabel: todayLabel,
      cart: cart,
      cartCount: cart.length,
      cartTotal: cartTotal
    });
  },

  onEditFam() {
    wx.switchTab({ url: '/pages/me/index' });
  },

  onHealth() {
    wx.showModal({
      title: '健康档案',
      content: '过敏原：' + (this.data.avoidText || '未设置') + '\n疾病史：' + (this.data.condText || '未设置') + '\n\n在「我的」里可以修改',
      showCancel: false
    });
  },

  onSystem(e) {
    const key = e.currentTarget.dataset.key;
    S.state.family.system = key;
    S.state.week = null;
    S.save();
    this.render();
    wx.showToast({ title: '已切换：' + (D.SYSTEM_MAP[key] ? D.SYSTEM_MAP[key].name : ''), icon: 'none' });
  },

  onGenerate() {
    const st = S.state;
    st.week = E.planWeek(st);

    // 生成采购清单：逐道菜算缺料
    const miss = {};
    st.week.forEach(d => {
      Object.keys(d.meals || {}).forEach(k => {
        const m = d.meals[k];
        (m.ids || []).forEach(id => {
          const dish = D.DISHES.filter(x => x.id === id)[0];
          if (!dish) return;
          E.ingredientState(dish, st.foods).forEach(s => {
            if (s.ok) return;
            const need = (dish.ingredients.filter(i => i.name === s.name)[0] || {}).qty || 0;
            miss[s.name] = (miss[s.name] || 0) + need;
          });
        });
      });
    });
    st.cart = Object.keys(miss).map(n => {
      const meta = E.foodMeta(n);
      return { name: n, emoji: meta.emoji, unit: meta.unit, qty: Math.round(miss[n] * 10) / 10 };
    });
    S.save();
    this.render();
    wx.showToast({ title: '已生成 7 天菜单', icon: 'none' });
  },

  onParty() {
    wx.navigateTo({ url: '/pages/party/index' });
  },

  onNearby() {
    wx.navigateTo({ url: '/pages/nearby/index' });
  },

  onBought(e) {
    const i = parseInt(e.currentTarget.dataset.i, 10);
    const st = S.state;
    const c = st.cart[i];
    if (!c) return;
    S.add(c.name, Math.max(c.qty, 1), 7);
    st.cart.splice(i, 1);
    S.save();
    this.render();
    wx.showToast({ title: '已入库', icon: 'none' });
  },

  onBuyAll() {
    if (!S.state.cart.length) return;
    S.buyCart();
    this.render();
    wx.showToast({ title: '全部已入库', icon: 'none' });
  },

  onClearCart() {
    S.clearCart();
    this.render();
  }
});
