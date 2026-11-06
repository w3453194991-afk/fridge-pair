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

      // 把「我的菜谱」（自定义 / 网上抓的）重新挂回菜谱库，
      // 否则重启后聚餐规划、配餐都看不到它们
      try {
        if (G.DD_ENGINE && G.DD_ENGINE.attachCustom && Array.isArray(S.state.custom) && S.state.custom.length) {
          G.DD_ENGINE.attachCustom(S.state.custom);
          console.log('[custom] 已恢复菜品', S.state.custom.length, '道');
        }
      } catch (e) {
        console.warn('[custom] 恢复失败', e && e.message);
      }

      // 云开发（可选）：配了环境 ID 才初始化
      if (CFG && CFG.CLOUD_ENV && wx.cloud) {
        try {
          wx.cloud.init({ env: CFG.CLOUD_ENV, traceUser: true });
          console.log('[cloud] 已初始化环境', CFG.CLOUD_ENV);
          this.loadPrices();
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

  /* 拉取云端菜价，覆盖内置单价（拿不到就用内置值） */
  loadPrices() {
    wx.cloud.callFunction({
      name: 'prices',
      data: { action: 'get' },
      success: (res) => {
        const d = (res && res.result) || {};
        const items = Array.isArray(d.items) ? d.items : [];
        if (!items.length) {
          G.__prices = { count: 0, updatedAt: 0 };
          return;
        }
        const db = G.DD_DATA.FOOD_DB || [];
        let n = 0;
        items.forEach((it) => {
          if (!it || typeof it.price !== 'number') return;
          const f = db.filter((x) => x.name === it.name)[0];
          if (f) { f.price = it.price; n++; }
        });
        G.__prices = { count: n, updatedAt: d.updatedAt || 0 };
        console.log('[prices] 已更新' + n + '项');
      },
      fail: () => { G.__prices = { count: 0, updatedAt: 0 }; }
    });
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
