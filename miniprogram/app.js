/* ============================================================
   冰箱对对碰 · 小程序入口
   核心逻辑直接复用 web 版（data / engine / store），视图用 WXML 重写
   ============================================================ */
const G = require('./lib/shim.js');

try {
  require('./lib/data.js');
  require('./lib/engine.js');
  require('./lib/store.js');
} catch (e) {
  wx.showModal({
    title: '核心加载失败',
    content: String(e && e.message || e).slice(0, 180),
    showCancel: false
  });
}

const S = G.DD_STORE;

App({
  onLaunch() {
    try {
      if (!G.DD_DATA || !G.DD_ENGINE || !S) {
        throw new Error('核心未挂载: ' + [!!G.DD_DATA, !!G.DD_ENGINE, !!S].join(','));
      }
      S.load();
      if (!S.state.family.loggedIn) {
        S.demoFamily();
        S.save();
      }
      G.__ready = true;
    } catch (e) {
      wx.showModal({
        title: '启动失败',
        content: String(e && e.message || e).slice(0, 180),
        showCancel: false
      });
    }
  },

  onError(err) {
    wx.showModal({ title: '运行出错', content: String(err).slice(0, 180), showCancel: false });
  },

  h: {
    toast(msg) {
      wx.showToast({ title: msg, icon: 'none' });
    }
  }
});
