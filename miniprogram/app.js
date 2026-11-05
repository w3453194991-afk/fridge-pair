/* ============================================================
   冰箱对对碰 · 小程序入口
   核心逻辑直接复用 web 版（data / engine / store），视图用 WXML 重写
   ============================================================ */
require('./lib/shim.js');
require('./lib/data.js');
require('./lib/engine.js');
require('./lib/store.js');

const S = globalThis.DD_STORE;

App({
  onLaunch() {
    S.load();
    // 首次进入自动建一个演示家庭，避免空冰箱
    if (!S.state.family.loggedIn) {
      S.demoFamily();
      S.save();
    }
  },
  // 通用工具，页面里用 getApp().h.xxx
  h: {
    tierWord(t) {
      return { g: '充足', y: '正常', p: '临期', b: '过期' }[t] || '';
    },
    toast(msg) {
      wx.showToast({ title: msg, icon: 'none' });
    }
  }
});
