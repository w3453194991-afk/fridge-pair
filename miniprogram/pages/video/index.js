const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let CONFIG = {};
try { CONFIG = require('../../config.js') || {}; } catch (e) {}

const HOT = ['番茄炒蛋', '红烧肉', '可乐鸡翅', '糖醋排骨', '宫保鸡丁', '麻婆豆腐',
  '水煮鱼', '鱼香肉丝', '清蒸鲈鱼', '蒜蓉西兰花', '酸辣土豆丝', '地三鲜'];

Page({
  data: {
    q: '',
    kw: '',
    hot: [],
    platforms: [],
    copied: '',
    appId: (CONFIG && CONFIG.RECIPE_MINI_APPID) || '',
    appPath: (CONFIG && CONFIG.RECIPE_MINI_PATH) || ''
  },

  onLoad(opt) {
    const q = opt && opt.q ? decodeURIComponent(opt.q) : '番茄炒蛋';
    this.setData({
      q: q,
      kw: q + ' 做法',
      hot: HOT,
      platforms: (D.PLATFORMS || []).map(p => ({ key: p.key, label: p.icon + ' ' + p.name }))
    });
  },

  sync(q) {
    this.setData({ q: q, kw: q + ' 做法', copied: '' });
  },

  onInput(e) {
    this.sync(e.detail.value);
  },

  onHot(e) {
    this.sync(e.currentTarget.dataset.n);
  },

  onCopy() {
    const kw = (this.data.kw || '').trim();
    if (!kw) return;
    wx.setClipboardData({
      data: kw,
      success: () => {
        this.setData({ copied: kw });
        wx.showToast({ title: '搜索词已复制', icon: 'none' });
      }
    });
  },

  onPlatform(e) {
    const name = e.currentTarget.dataset.name;
    const kw = (this.data.kw || '').trim();
    if (!kw) return;
    wx.setClipboardData({
      data: kw,
      success: () => {
        this.setData({ copied: kw });
        wx.showModal({
          title: '搜索词已复制',
          content: '「' + kw + '」\n\n打开' + name + '，点顶部搜索框 → 粘贴 → 搜索，出来的就是做菜教程。\n\n（不要把网址粘进搜索框，那会搜成网页本身）',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  /* 站内看图文做法（不用跳出去） */
  onInApp() {
    const q = (this.data.q || '').trim();
    if (!q) return;
    wx.navigateTo({ url: '/pages/netrecipe/index?q=' + encodeURIComponent(q) });
  },

  /* 跳转第三方菜谱小程序（需在 config.js 填 AppID） */
  onThirdApp() {
    const appId = (this.data.appId || '').trim();
    if (!appId) {
      wx.showModal({
        title: '还没配置',
        content: '在 miniprogram/config.js 里填 RECIPE_MINI_APPID（第三方菜谱小程序的 AppID），并在 app.json 的 navigateToMiniProgramAppIdList 里声明，就能一键跳转。',
        showCancel: false
      });
      return;
    }
    wx.navigateToMiniProgram({
      appId: appId,
      path: this.data.appPath || '',
      fail: (err) => {
        wx.showModal({ title: '跳转失败', content: String((err && err.errMsg) || ''), showCancel: false });
      }
    });
  }
});
