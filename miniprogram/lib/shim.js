/* ============================================================
   小程序环境垫片
   不依赖 globalThis / window 的全局挂载，改为「导出共享对象」
   核心文件由 tools/build-mp.mjs 在顶部注入：
     const window = require('./shim.js')
     const localStorage = window.localStorage
   ============================================================ */
const shared = {};

/* 用 wx 同步存储实现 localStorage */
shared.localStorage = {
  getItem(key) {
    try {
      const v = wx.getStorageSync(key);
      return v === '' || v === undefined || v === null ? null : v;
    } catch (e) { return null; }
  },
  setItem(key, value) {
    try { wx.setStorageSync(key, String(value)); } catch (e) {}
  },
  removeItem(key) {
    try { wx.removeStorageSync(key); } catch (e) {}
  }
};

/* 少数代码会读 location.protocol 判断 PWA */
shared.location = { protocol: 'https:', href: '', hash: '' };

/* 自引用，方便核心文件里 (function(w){...})(window) 拿到同一对象 */
shared.window = shared;

module.exports = shared;
