const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let P = {};
try { P = require('../../lib/photos.js') || {}; } catch (e) { P = {}; }

Page({
  data: {
    dish: null,
    states: [],
    prep: [],
    steps: [],
    can: false
  },

  onLoad(q) {
    const d = D.DISHES.filter(x => x.id === q.id)[0];
    if (!d) { wx.navigateBack(); return; }
    const st = S.state;

    const states = E.ingredientState(d, st.foods).map(s => ({
      name: s.name,
      amount: E.fmtQty(s.qty) + ' ' + (s.unit || ''),
      ok: s.ok,
      pillCls: s.ok ? 'pill g' : 'pill b',
      pillText: s.ok ? '库存够' : (s.expired ? '已过期' : '缺料')
    }));

    this.setData({
      dish: {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        minutes: d.minutes,
        level: d.level,
        cuisine: (d.cuisine || []).join(' / '),
        tags: (d.tags || []).join(' · '),
        seasonings: d.seasonings || [],
        photo: P[d.id] ? ('/img/' + d.id + '.jpg') : ''
      },
      steps: (d.steps || []).map((s, i) => ({ no: i + 1, heat: s.heat, text: s.text })),
      prep: d.prep || [],
      states: states,
      can: states.every(s => s.ok)
    });
  },

  onCook() {
    try {
      const d = D.DISHES.filter(x => x.id === this.data.dish.id)[0];
      if (!d) return;
      const states = E.ingredientState(d, S.state);
      if (!states.every(s => s.ok)) {
        const lack = states.filter(s => !s.ok).map(s => s.name).join('、');
        wx.showToast({ title: '还差：' + lack, icon: 'none' });
        return;
      }
      const res = E.cook(d, S.state);
      S.save();
      const lines = res.used.map(u => u.name + ' -' + E.fmtQty(u.qty) + u.unit + '（剩 ' + E.fmtQty(u.left) + '）').join('\n');
      wx.showModal({
        title: '做完啦，库存已更新',
        content: lines,
        showCancel: false,
        confirmText: '好的',
        success: () => wx.navigateBack()
      });
    } catch (err) {
      wx.showModal({ title: '操作失败', content: String((err && err.message) || err), showCancel: false });
    }
  },

  onVideo() {
    wx.navigateTo({ url: '/pages/video/index?q=' + encodeURIComponent(this.data.dish.name) });
  }
});
