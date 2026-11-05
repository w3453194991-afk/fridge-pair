const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

function applyAction(act) {
  if (!act || !act.op) return '';
  const fam = S.state.family;
  const arr = k => (fam[k] = fam[k] || []);
  let note = '';
  switch (act.op) {
    case 'allergy.add':
      if (arr('avoid').indexOf(act.value) < 0) fam.avoid.push(act.value);
      S.state.week = null; S.save(); break;
    case 'allergy.remove': {
      const i = arr('avoid').indexOf(act.value);
      if (i >= 0) fam.avoid.splice(i, 1);
      S.state.week = null; S.save(); break;
    }
    case 'condition.add':
      if (arr('conditions').indexOf(act.value) < 0) fam.conditions.push(act.value);
      S.state.week = null; S.save(); break;
    case 'condition.remove': {
      const i = arr('conditions').indexOf(act.value);
      if (i >= 0) fam.conditions.splice(i, 1);
      S.state.week = null; S.save(); break;
    }
    case 'system':
      fam.system = act.value; S.state.week = null; S.save(); break;
    case 'pin':
      try { S.togglePin(act.value); } catch (e) {}
      break;
    case 'food.add':
      try { S.add(act.value.name, act.value.qty, 7); } catch (e) {}
      break;
    case 'food.consume': {
      const f = S.state.foods.filter(x => x.name === act.value)[0];
      if (f) S.consume(f.id, 1);
      break;
    }
    case 'nav':
      note = act.value;
      if (act.value === 'plan') wx.switchTab({ url: '/pages/plan/index' });
      else if (act.value === 'recipe') wx.switchTab({ url: '/pages/recipe/index' });
      else if (act.value === 'fridge') wx.switchTab({ url: '/pages/fridge/index' });
      else if (act.value === 'nearby') wx.navigateTo({ url: '/pages/nearby/index' });
      break;
    default:
      break;
  }
  return note;
}

Page({
  data: {
    msgs: [],
    draft: '',
    chips: ['今晚吃什么', '什么快坏了', '我对海鲜过敏', '我有高血压', '这周吃西餐', '刚买了 2 个番茄']
  },

  onLoad() {
    this.setData({
      msgs: [{
        id: 'b0',
        role: 'bot',
        text: '我是冰箱管家 🧊 我不只会回答，还能直接帮你改设置：说「我对海鲜过敏」「我有高血压」「这周吃西餐」「刚买了 2 个番茄」。'
      }]
    });
  },

  onInput(e) {
    this.setData({ draft: e.detail.value });
  },

  onChip(e) {
    this.ask(e.currentTarget.dataset.t);
  },

  onSend() {
    this.ask(this.data.draft);
  },

  ask(q) {
    const text = String(q || '').trim();
    if (!text) return;
    const msgs = this.data.msgs.slice();
    msgs.push({ id: 'm' + Date.now(), role: 'me', text: text });
    this.setData({ msgs: msgs, draft: '' });

    wx.showLoading({ title: '思考中', mask: false });
    setTimeout(() => {
      let reply = '';
      let act = null;
      try {
        const res = E.assistant(text, S.state);
        reply = res.reply || '我没听明白，换个说法试试？';
        act = res.action || null;
      } catch (err) {
        reply = '出了点问题：' + ((err && err.message) || err);
      }
      wx.hideLoading();

      const navTo = act ? applyAction(act) : '';
      const list = this.data.msgs.slice();
      list.push({ id: 'b' + Date.now(), role: 'bot', text: reply });
      this.setData({ msgs: list });
      wx.pageScrollTo({ scrollTop: 99999, duration: 200 });
      if (!navTo) wx.showToast({ title: '已更新设置', icon: 'none' });
    }, 260);
  }
});
