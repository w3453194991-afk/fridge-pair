const G = require('../../lib/shim.js');
const PRICE = require('../../lib/price.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
function validPhoto(p) {
  if (!p || typeof p !== 'string') return false;
  if (p.indexOf('store/') === 0) return false;
  return /^(wxfile:|http:\/\/tmp|https:\/\/|cloud:\/\/|\/|data:image)/.test(p);
}
let P = {};
try { P = require('../../lib/photos.js') || {}; } catch (e) { P = {}; }

Page({
  data: {
    dish: null,
    states: [],
    prep: [],
    steps: [],
    can: false,
    hasVideo: false,

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

    const raw = E.ingredientState(d, st.foods);
    const states = raw.map(s => ({
      name: s.name,
      amount: E.fmtQty(s.qty) + ' ' + (s.unit || ''),
      ok: s.ok,
      pillCls: s.ok ? 'pill g' : 'pill b',
      pillText: s.ok ? '库存够' : (s.expired ? '已过期' : '缺料')
    }));

    const missing = raw.filter(s => !s.ok).map(s => {
      const meta = E.foodMeta(s.name);
      const needQty = Math.max(0, s.qty - s.haveQty);
      return {
        name: s.name,
        emoji: meta.emoji || '🍽',
        need: E.fmtQty(needQty) + ' ' + (s.unit || ''),
        price: meta.price || 0,
        priceText: PRICE.yuan(needQty * (meta.price || 0))
      };
    });

    const playable = (d.videos || []).filter(v => typeof v === 'string' && v);

    this.setData({
      hasVideo: playable.length > 0,
      dish: {
        id: d.id, name: d.name, emoji: d.emoji, minutes: d.minutes,
        level: d.level, cuisine: (d.cuisine || []).join(' / '),
        tags: (d.tags || []).join(' · '), seasonings: d.seasonings || [],
        videos: playable,
        custom: !!d.custom || (d.tags || []).indexOf('AI生成') >= 0,
        photo: (P[d.id] && !validPhoto(S.getDishPhoto(d.id))) ? ('/img/' + d.id + '.jpg') : (validPhoto(S.getDishPhoto(d.id)) ? S.getDishPhoto(d.id) : '')
      },
      steps: (d.steps || []).map((s, i) => ({ no: i + 1, heat: s.heat, text: s.text })),
      prep: d.prep || [],
      states: states,
      missing: missing,
      missingCount: missing.length,
      can: states.every(s => s.ok)
    });
    this.dish = d;
  },

  /* 缺的料一次加进采购清单 */
  onBuyMissing() {
    const list = this.data.missing || [];
    if (!list.length) {
      wx.showToast({ title: '食材齐全', icon: 'none' });
      return;
    }
    try {
      S.addCart(list.map(m => ({
        name: m.name,
        emoji: m.emoji,
        unit: '',
        qty: Math.max(1, Math.round(parseFloat(m.need) || 1)),
        price: m.price || 0
      })));
      S.save();
    } catch (e) {
      wx.showModal({ title: '加入失败', content: String((e && e.message) || e), showCancel: false });
      return;
    }
    wx.showToast({ title: '已加入采购清单', icon: 'success' });
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
    const d = this.data.dish;
    const playable = (d && d.videos ? d.videos : []).filter(v => typeof v === 'string' && v);
    if (playable.length) {
      wx.navigateTo({ url: '/pages/player/index?id=' + d.id + '&v=1' });
      return;
    }
    wx.navigateTo({ url: '/pages/video/index?q=' + encodeURIComponent(d.name) });
  },

  /* 给这道菜挂一个自己的做法视频（录音/相册），存云存储，站内直接播 */
  onAddVideo() {
    const d = this.data.dish;
    if (!d) return;
    if (!wx.cloud) {
      wx.showModal({ title: '需要云开发', content: '上传视频要用云存储，请在 config.js 配置 CLOUD_ENV。', showCancel: false });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      camera: 'back',
      success: (res) => {
        const f = (res.tempFiles || [])[0];
        if (!f || !f.tempFilePath) return;
        if (f.size && f.size > 20 * 1024 * 1024) {
          wx.showToast({ title: '视频别超过 20MB', icon: 'none' });
          return;
        }
        wx.showLoading({ title: '上传中…', mask: true });
        const ext = (f.tempFilePath.match(/\.(\w+)$/) || [, 'mp4'])[1];
        wx.cloud.uploadFile({
          cloudPath: 'dish-videos/' + d.id + '-' + Date.now() + '.' + ext,
          filePath: f.tempFilePath,
          success: (r) => {
            wx.hideLoading();
            try {
              S.setDishVideo(d.id, r.fileID);
              const cur = this.data.dish;
              cur.videos = [r.fileID];
              this.setData({ dish: cur });
            } catch (e) {}
            wx.showToast({ title: '已添加视频', icon: 'success' });
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showModal({ title: '上传失败', content: String((err && err.errMsg) || ''), showCancel: false });
          }
        });
      }
    });
  },

  /* 站内直接拉网上的图文做法，不用跳出小程序 */
  onWebRecipe() {
    wx.navigateTo({ url: '/pages/netrecipe/index?q=' + encodeURIComponent(this.data.dish.name) });
  },

  /* 删除自定义/网上菜谱 */
  onRemove() {
    const d = this.data.dish;
    if (!d) return;
    wx.showModal({
      title: '移除这道菜',
      content: '「' + d.name + '」会从你的菜谱库删除，冰箱和家庭档案不受影响。',
      confirmText: '移除',
      confirmColor: '#B91C1C',
      success: (r) => {
        if (!r.confirm) return;
        try {
          if (S.removeCustom) S.removeCustom(d.id);
          for (let i = D.DISHES.length - 1; i >= 0; i--) {
            if (D.DISHES[i].id === d.id) D.DISHES.splice(i, 1);
          }
          S.save();
        } catch (e) {
          wx.showModal({ title: '移除失败', content: String((e && e.message) || e), showCancel: false });
          return;
        }
        wx.showToast({ title: '已移除', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 400);
      }
    });
  }
});
