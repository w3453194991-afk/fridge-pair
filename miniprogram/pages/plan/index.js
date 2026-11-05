const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: { days: [], has: false, system: '中式' },

  onShow() { this.render(); },

  render() {
    const st = S.state;
    const sys = D.SYSTEM_MAP && D.SYSTEM_MAP[st.family.system];
    const week = st.week;
    if (!week || !week.length) {
      this.setData({ days: [], has: false, system: sys ? sys.name : '中式' });
      return;
    }
    const days = week.map(d => {
      const meals = [];
      ['早', '午', '晚'].forEach(slot => {
        const m = d.meals[slot];
        if (!m || !m.ids || !m.ids.length) return;
        const names = m.ids.map(id => {
          const x = D.DISHES.filter(y => y.id === id)[0];
          return x ? x.emoji + ' ' + x.name : '';
        }).filter(Boolean);
        meals.push({ slot: slot, names: names.join('、'), missing: !!m.missing });
      });
      return { label: d.label, meals: meals };
    });
    this.setData({ days: days, has: true, system: sys ? sys.name : '中式' });
  },

  onGenerate() {
    S.state.week = E.planWeek(S.state);
    S.save();
    this.render();
    wx.showToast({ title: '已生成 7 天菜单', icon: 'none' });
  },

  onDish(e) {
    wx.navigateTo({ url: '/pages/dish/index?id=' + e.currentTarget.dataset.id });
  }
});
