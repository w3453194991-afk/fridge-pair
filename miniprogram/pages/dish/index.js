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
    const dish = this.data.dish;
    if (!dish) {
      wx.showToast({ title: '页面数据未就绪', icon: 'none' });
      return;
    }
    const d = D.DISHES.filter(x => x.id === dish.id)[0];
    if (!d) {
      wx.showToast({ title: '找不到这道菜', icon: 'none' });
      return;
    }

    const states = E.ingredientState(d, S.state.foods);
    const lack = states.filter(s => !s.ok).map(s => s.name);
    if (lack.length) {
      wx.showModal({
        title: '还差食材',
        content: lack.join('、') + '\n\n先去采购或改成别的菜吧。',
        showCancel: false
      });
      return;
    }

    let lines = '';
    try {
      const res = E.cook(d, S.state);
      try { S.save(); } catch (saveErr) { console.error('[cook] 保存失败（不影响本次扣减）', saveErr); }
      lines = res.used.map(u => u.name + ' -' + E.fmtQty(u.qty) + u.unit + '（剩 ' + E.fmtQty(u.left) + '）').join('\n');
    } catch (err) {
      console.error('[cook] 引擎扣减失败', err);
      // 兜底：按菜谱用量手动扣减
      lines = this.fallbackCook(d);
      if (!lines) {
        wx.showModal({
          title: '操作失败',
          content: '原因：' + ((err && err.message) || err) + '\n\n把这段发给开发者即可定位。',
          showCancel: false
        });
        return;
      }
      lines = lines + '\n\n（兜底模式完成）';
    }

    wx.showModal({
      title: '做完啦，库存已更新',
      content: lines,
      showCancel: false,
      confirmText: '好的',
      success: () => wx.navigateBack()
    });
  },

  /** 兜底：不依赖引擎的扣减 */
  fallbackCook(d) {
    try {
      const st = S.state;
      const out = [];
      (d.ingredients || []).forEach(ing => {
        const f = st.foods.filter(x => x.name === ing.name)[0];
        if (!f) return;
        const used = Math.min(f.qty, ing.qty);
        f.qty = Math.round((f.qty - used) * 100) / 100;
        out.push(ing.name + ' -' + used + (f.unit || '') + '（剩 ' + f.qty + '）');
      });
      st.foods = st.foods.filter(x => x.qty > 0.001);
      if (st.stats) st.stats.cooked = (st.stats.cooked || 0) + 1;
      S.save();
      return out.join('\n');
    } catch (e) {
      console.error('[cook] 兜底也失败', e);
      return '';
    }
  },

  onVideo() {
    wx.navigateTo({ url: '/pages/video/index?q=' + encodeURIComponent(this.data.dish.name) });
  }
});
