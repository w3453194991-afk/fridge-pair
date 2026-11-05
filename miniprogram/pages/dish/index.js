const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: { dish: null, can: false, states: [], steps: [] },

  onLoad(q) {
    const d = D.DISHES.filter(x => x.id === q.id)[0];
    if (!d) { wx.navigateBack(); return; }
    const st = S.state;
    const states = E.ingredientState(d, st.foods).map(s => ({
      name: s.name,
      need: s.need + ' ' + (s.unit || ''),
      ok: s.ok,
      pillCls: s.ok ? 'pill g' : 'pill b',
      pillText: s.ok ? '库存够' : '缺料'
    }));
    this.setData({
      dish: {
        id: d.id, name: d.name, emoji: d.emoji, minutes: d.minutes,
        level: d.level, cuisine: (d.cuisine || []).join(' / '),
        tags: (d.tags || []).join(' · '),
        seasonings: d.seasonings || []
      },
      steps: d.steps.map((s, i) => ({ no: i + 1, heat: s.heat, text: s.text })),
      prep: d.prep || [],
      states: states,
      can: states.every(s => s.ok)
    });
  },

  onCook() {
    if (!this.data.can) {
      wx.showToast({ title: '还差食材，先补料', icon: 'none' });
      return;
    }
    const d = D.DISHES.filter(x => x.id === this.data.dish.id)[0];
    const res = E.cook(d, S.state);
    S.save();
    const lines = res.used.map(u => u.name + ' -' + E.fmtQty(u.qty) + u.unit).join('，');
    wx.showModal({
      title: '做完啦，库存已更新',
      content: lines,
      showCancel: false,
      confirmText: '好的',
      success: () => {
        globalThis.__needRefresh = true;
        wx.navigateBack();
      }
    });
  }
});
