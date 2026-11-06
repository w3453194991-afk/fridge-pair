const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let CONFIG = {};
try { CONFIG = require('../../config.js') || {}; } catch (e) {}

Page({
  data: {
    q: '',
    loading: false,
    err: '',
    items: [],
    addedIdx: -1,
    needConfig: false
  },

  onLoad(opt) {
    const q = opt && opt.q ? decodeURIComponent(opt.q) : '';
    this.setData({ q: q || '' });
    if (q) this.search(q);
  },

  onInput(e) {
    this.setData({ q: e.detail.value });
  },

  onSearchTap() {
    this.search(this.data.q);
  },

  search(q) {
    const kw = String(q || '').trim();
    if (!kw) { this.setData({ err: '先输入菜名' }); return; }
    if (!CONFIG.CLOUD_ENV || !wx.cloud) {
      this.setData({ err: '未配置云开发，无法联网取菜谱' });
      return;
    }

    const self = this;
    this.setData({ loading: true, err: '', items: [], needConfig: false, addedIdx: -1 });

    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'search', keyword: kw },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          self.setData({
            loading: false,
            err: d.error || '没有找到',
            needConfig: !!d.needConfig
          });
          return;
        }
        const items = (d.items || []).map(x => ({
          name: x.name,
          emoji: x.emoji || '🍽',
          ingredients: (x.ingredients || []).map(i => i.name).join(' + '),
          stepCount: (x.steps || []).length,
          firstStep: (x.steps && x.steps[0] && x.steps[0].text) || '',
          raw: x
        }));
        self.setData({ loading: false, items: items, err: items.length ? '' : '没有找到相关菜谱' });
      },
      fail: (err) => {
        self.setData({ loading: false, err: '调用失败：' + ((err && err.errMsg) || '') });
      }
    });
  },

  /* 把网上的菜谱加进我的库 */
  onAdd(e) {
    const i = Number(e.currentTarget.dataset.i);
    const item = this.data.items[i];
    if (!item || !item.raw) return;

    const raw = item.raw;
    const draft = {
      id: 'w-' + Date.now().toString(36) + '-' + i,
      name: raw.name,
      emoji: raw.emoji || '🍽',
      minutes: raw.minutes || 20,
      level: raw.level || '进阶',
      cuisine: raw.cuisine && raw.cuisine.length ? raw.cuisine : ['家常'],
      meals: ['午', '晚'],
      tags: (raw.tags || []).concat(['网上菜谱']),
      ingredients: (raw.ingredients || []).map(x => {
        const meta = E.foodMeta(x.name);
        return { name: x.name, qty: x.qty || 1 };
      }),
      seasonings: raw.seasonings || [],
      prep: raw.prep || [],
      steps: raw.steps || [],
      tips: raw.tips || [],
      nutrition: '来自网上菜谱，营养值按主要食材估算。',
      pair: '网上菜谱 · 仅供参考',
      custom: true
    };

    try {
      S.addCustom(draft);
      E.attachCustom([draft]);
      S.save();
    } catch (err) {
      wx.showModal({ title: '加入失败', content: String((err && err.message) || err), showCancel: false });
      return;
    }
    this.setData({ addedIdx: i });
    wx.showToast({ title: '已加入菜谱库', icon: 'success' });
  },

  onOpen(e) {
    const i = Number(e.currentTarget.dataset.i);
    const item = this.data.items[i];
    if (!item) return;
    // 先在本地库里找到同名菜，再跳详情；找不到就提示先加入
    const hit = D.DISHES.filter(d => d.name === item.name)[0];
    if (hit) {
      wx.navigateTo({ url: '/pages/dish/index?id=' + hit.id });
    } else {
      wx.showToast({ title: '先点「加入」再看详情', icon: 'none' });
    }
  },

  onBack() {
    wx.navigateBack();
  },

  /* 网上取不到时，用本地规则生成一份（带 AI 生成标记），保证有菜可用 */
  onLocalGen() {
    const name = String(this.data.q || '').trim();
    if (!name) return;
    wx.showModal({
      title: '用模板生成',
      content: '「' + name + '」网上没取到，将按菜名规则生成一份做法（标注为 AI 生成，仅供参考）。',
      success: (r) => {
        if (!r.confirm) return;
        try {
          const draft = E.generateRecipe(name);
          draft.tags = (draft.tags || []).concat(['AI生成']);
          S.addCustom(draft);
          E.attachCustom([draft]);
          S.save();
        } catch (err) {
          wx.showModal({ title: '生成失败', content: String((err && err.message) || err), showCancel: false });
          return;
        }
        wx.showToast({ title: '已加入菜谱库', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      }
    });
  }
});
