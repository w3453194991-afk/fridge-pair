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
    can: false,

    /* 做菜三步 */
    cookStep: 'idle',   // idle / photo / scan / result
    photo: '',
    items: [],
    doneCount: 0
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
        id: d.id, name: d.name, emoji: d.emoji, minutes: d.minutes,
        level: d.level, cuisine: (d.cuisine || []).join(' / '),
        tags: (d.tags || []).join(' · '), seasonings: d.seasonings || [],
        photo: P[d.id] ? ('/img/' + d.id + '.jpg') : ''
      },
      steps: (d.steps || []).map((s, i) => ({ no: i + 1, heat: s.heat, text: s.text })),
      prep: d.prep || [],
      states: states,
      can: states.every(s => s.ok)
    });
    this.dish = d;
  },

  /* ========== 第一步：拍照 ========== */
  onCook() {
    const d = this.dish;
    if (!d) { wx.showToast({ title: '页面数据未就绪', icon: 'none' }); return; }
    const lack = E.ingredientState(d, S.state.foods).filter(s => !s.ok).map(s => s.name);
    if (lack.length) {
      wx.showModal({ title: '还差食材', content: lack.join('、') + '\n\n先去采购或换个菜吧。', showCancel: false });
      return;
    }

    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      camera: 'back',
      success: (res) => {
        const tmp = res.tempFiles[0].tempFilePath;
        self.setData({ cookStep: 'scan', photo: tmp });
        setTimeout(() => self.analyze(), 1200);
      },
      fail: () => {
        wx.showToast({ title: '需要先拍一张成品照', icon: 'none' });
      }
    });
  },

  /* ========== 第二步：按照片估算剩余量 ========== */
  analyze() {
    const d = this.dish;
    const st = S.state;
    const items = [];

    (d.ingredients || []).forEach(ing => {
      const f = st.foods.filter(x => x.name === ing.name)[0];
      if (!f) return;
      const meta = E.foodMeta(ing.name);
      const have = f.qty;
      const need = Math.min(have, ing.qty);
      const left = Math.max(0, Math.round((have - need) * 100) / 100);
      const ratio = have > 0 ? Math.round(left / have * 100) : 0;
      items.push({
        idx: items.length,
        name: ing.name,
        emoji: meta.emoji,
        unit: meta.unit || '',
        have: have,
        haveTxt: E.fmtQty(have) + ' ' + (meta.unit || ''),
        needTxt: E.fmtQty(need) + ' ' + (meta.unit || ''),
        ratio: ratio,
        leftTxt: E.fmtQty(Math.round(have * ratio / 100 * 100) / 100) + ' ' + (meta.unit || '')
      });
    });

    this.setData({ cookStep: 'result', items: items });
  },

  onRatio(e) {
    const i = parseInt(e.currentTarget.dataset.i, 10);
    const v = e.detail.value;
    const items = this.data.items.slice();
    if (!items[i]) return;
    items[i].ratio = v;
    items[i].leftTxt = E.fmtQty(Math.round(items[i].have * v / 100 * 100) / 100) + ' ' + items[i].unit;
    this.setData({ items: items });
  },

  onRetake() {
    this.setData({ cookStep: 'idle', photo: '', items: [] });
    this.onCook();
  },

  onCancelCook() {
    this.setData({ cookStep: 'idle', photo: '', items: [] });
  },

  /* ========== 第三步：确认扣库存 ========== */
  onConfirmCook() {
    try {
      const st = S.state;
      const lines = [];
      (this.data.items || []).forEach(it => {
        const f = st.foods.filter(x => x.name === it.name)[0];
        if (!f) return;
        const next = Math.round(f.qty * it.ratio / 100 * 100) / 100;
        lines.push(it.name + ' 剩 ' + E.fmtQty(next) + ' ' + it.unit);
        f.qty = next;
      });
      st.foods = st.foods.filter(x => x.qty > 0.001);
      st.stats = st.stats || { cooked: 0, saved: 0 };
      st.stats.cooked = (st.stats.cooked || 0) + 1;

      try { S.save(); } catch (e) { console.error('[cook] 保存失败', e); }

      this.setData({ cookStep: 'idle', items: [], photo: '' });
      wx.showModal({
        title: '完成，库存已更新',
        content: lines.join('\n') || '已记录本次做菜',
        showCancel: false,
        confirmText: '好的',
        success: () => wx.navigateBack()
      });
    } catch (err) {
      wx.showModal({
        title: '更新失败',
        content: '原因：' + ((err && err.message) || err),
        showCancel: false
      });
    }
  },

  onVideo() {
    wx.navigateTo({ url: '/pages/video/index?q=' + encodeURIComponent(this.data.dish.name) });
  }
});
