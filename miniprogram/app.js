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

let CFG = {};
try { CFG = require('./config.js') || {}; } catch (e) { CFG = {}; }

App({
  onLaunch() {
    try {
      if (!G.DD_DATA || !G.DD_ENGINE || !S) {
        throw new Error('核心未挂载: ' + [!!G.DD_DATA, !!G.DD_ENGINE, !!S].join(','));
      }
      // 只加载，不自动登录 —— 登录页负责创建家庭档案
      S.load();

      // 云开发（可选）：配了环境 ID 才初始化
      if (CFG && CFG.CLOUD_ENV && wx.cloud) {
        try {
          wx.cloud.init({ env: CFG.CLOUD_ENV, traceUser: true });
          console.log('[cloud] 已初始化环境', CFG.CLOUD_ENV);
        } catch (e) {
          console.warn('[cloud] 初始化失败', e && e.message);
        }
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

  // 任何找不到的页面都回登录页，避免弹出 onPageNotFound 的错误框
  onPageNotFound(res) {
    console.warn('[mp] 页面不存在:', res && res.path);
    wx.reLaunch({ url: '/pages/login/index' });
  },

  h: {
    toast(msg) {
      wx.showToast({ title: msg, icon: 'none' });
    }
  }
});
