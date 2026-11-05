/* ============================================================
   小程序环境垫片：让 web 版核心（依赖 window / localStorage）原样运行
   ============================================================ */
const g = typeof globalThis !== 'undefined' ? globalThis : global;

if (!g.window) g.window = g;

if (!g.localStorage) {
  g.localStorage = {
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
}

/* 部分代码会读 location.protocol 判断 PWA，小程序里忽略 */
if (!g.location) g.location = { protocol: 'https:', href: '', hash: '' };

module.exports = g;
