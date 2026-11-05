const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    systems: [],
    sysName: '',
    stripe: '',
    days: [],
    has: false,
    nutBars: [],
    todayLabel: '',
    shopList: [],
    shopCount: 0
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSel(2);
    this.render();
  },

  render() {
    const st = S.state;
    const sysKey = st.family.system || 'cn';
    const sys = D.SYSTEM_MAP[sysKey] || D.MEAL_SYSTEMS[0];

    const systems = D.MEAL_SYSTEMS.map(s => ({
      key: s.key,
      label: s.emoji + ' ' + s.name,
      cls: s.key === sysKey ? 'chip on' : 'chip'
    }));

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
          const target = E.perMealTarget(st.family);
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

    const miss = {};
    week.forEach(d => {
      Object.keys(d.meals || {}).forEach(k => {
        const m = d.meals[k];
        ((m && m.missing) || []).forEach(n => { miss[n] = (miss[n] || 0) + 1; });
      });
    });
    const shopList = Object.keys(miss).map(n => {
      const meta = E.foodMeta(n);
      return { name: n, emoji: meta.emoji, times: miss[n] };
    }).sort((a, b) => b.times - a.times);

    this.setData({
      systems: systems,
      sysName: sys ? sys.name : '中式',
      stripe: sys ? ('早：' + (sys.slots['早'] || []).join(' + ')) : '',
      days: days,
      has: days.length > 0,
      nutBars: nutBars,
      todayLabel: todayLabel,
      shopList: shopList,
      shopCount: shopList.length
    });
  },

  onSystem(e) {
    const key = e.currentTarget.dataset.key;
    S.state.family.system = key;
    S.state.week = E.planWeek(S.state);
    S.save();
    this.render();
    wx.showToast({ title: '已切换并重排', icon: 'none' });
  },

  onGenerate() {
    S.state.week = E.planWeek(S.state);
    S.save();
    this.render();
    wx.showToast({ title: '已生成 7 天菜单', icon: 'none' });
  },

  onBuyAll() {
    if (!this.data.shopList.length) {
      wx.showToast({ title: '没有缺料', icon: 'none' });
      return;
    }
    const text = this.data.shopList.map(i => i.name + ' ×' + i.times).join('\n');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '采购清单已复制', icon: 'none' })
    });
  }
});
