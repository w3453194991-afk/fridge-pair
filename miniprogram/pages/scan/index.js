const G = require('../../lib/shim.js');
const privacy = require('../../lib/privacy.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let CONFIG = { API_BASE: '', USE_REMOTE: false, TIMEOUT: 15000 };
try { CONFIG = require('../../config.js') || CONFIG; } catch (e) {}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function inDb(name) { return (D.FOOD_DB || []).some(f => f.name === name); }

/* 每日调用次数限制（防刷 / 控成本） */
function dayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function todayCount(name) {
  try {
    const raw = wx.getStorageSync('ddm.quota.' + name);
    if (!raw || raw.day !== dayKey()) return 0;
    return raw.n || 0;
  } catch (e) { return 0; }
}
function bumpCount(name) {
  try {
    wx.setStorageSync('ddm.quota.' + name, { day: dayKey(), n: todayCount(name) + 1 });
  } catch (e) {}
}

Page({
  data: {
    photo: '',
    scanning: true,
    items: [],
    checkedCount: 0,
    round: 0,
    sourceText: '',
    sourceCls: 'src'
  },

  onLoad(q) {
    this.setData({ photo: (q && q.photo) || '' });

    const limit = Number(CONFIG.DAILY_SCAN_LIMIT) || 0;
    if (limit > 0 && todayCount('scan') >= limit) {
      wx.showModal({
        title: '今天的识别次数用完了',
        content: '每天最多识别 ' + limit + ' 次（防止滥用）。明天再来，或者手动添加食材。',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/fridge/index' })
      });
      return;
    }
    bumpCount('scan');

    this.analyze();
  },

  /* 优先走云函数 → HTTP 中转 → 本地演示 */
  analyze() {
    const self = this;
    this.setData({ scanning: true, sourceText: '' });

    if (!this.data.photo) {
      setTimeout(() => self.localBuild('演示识别'), 900);
      return;
    }

    let fs = null;
    try { fs = wx.getFileSystemManager(); } catch (e) { fs = null; }
    if (!fs) {
      this.localBuild('环境不支持读图，已回退');
      return;
    }

    fs.readFile({
      filePath: this.data.photo,
      encoding: 'base64',
      success: (r) => self.recognize(r.data),
      fail: () => self.localBuild('读图失败，已回退')
    });
  },

  recognize(base64) {
    const self = this;

    /* ① 云函数 */
    if (CONFIG.USE_CLOUD && CONFIG.CLOUD_ENV && wx.cloud) {
      wx.cloud.callFunction({
        name: 'recognize',
        data: { image: base64 },
        success: (res) => {
          const d = (res && res.result) || {};
          const list = Array.isArray(d.items) ? d.items : [];
          if (!list.length) { self.httpOrLocal(base64, '云函数无结果，已回退'); return; }
          self.applyResult(list, d.source === 'baidu' ? '百度 AI 识别（云函数）' : '云函数演示识别');
        },
        fail: (err) => {
          console.warn('[scan] 云函数失败', err && err.errMsg);
          self.httpOrLocal(base64, null);
        }
      });
      return;
    }

    this.httpOrLocal(base64, null);
  },

  httpOrLocal(base64, fallbackLabel) {
    const self = this;
    if (!CONFIG.USE_REMOTE || !CONFIG.API_BASE) {
      this.localBuild(fallbackLabel || '演示识别（未连服务）');
      return;
    }
    wx.request({
      url: CONFIG.API_BASE.replace(/\/$/, '') + '/recognize',
      method: 'POST',
      timeout: CONFIG.TIMEOUT || 15000,
      header: { 'content-type': 'application/json' },
      data: { image: base64 },
      success: (res) => {
        const d = (res && res.data) || {};
        const list = Array.isArray(d.items) ? d.items : [];
        if (!list.length) { self.localBuild(fallbackLabel || '识别无结果，已回退'); return; }
        self.applyResult(list, d.source === 'baidu' ? '百度 AI 识别' : '服务端识别');
      },
      fail: (err) => {
        console.warn('[scan] 请求失败', err && err.errMsg);
        self.localBuild('服务未连接，已回退演示');
      }
    });
  },

  applyResult(list, sourceText) {
    const items = list.slice(0, 8).map((x, i) => {
      const name = String(x.name || '').trim();
      const meta = E.foodMeta(name);
      const score = typeof x.score === 'number' ? x.score : 0.6;
      return {
        idx: i,
        name: name,
        emoji: meta.emoji || '🍽',
        unit: meta.unit || '份',
        qty: 1,
        shelf: meta.shelf || 7,
        storage: meta.storage || '',
        conf: Math.round(score * 100),
        checked: score >= 0.7,
        unknown: !inDb(name)
      };
    }).filter(x => x.name);

    this.setData({
      scanning: false,
      items: items,
      sourceText: sourceText,
      round: this.data.round + 1
    }, () => this.syncCount());
  },

  /* 本地演示：从场景库取一组 + 少量干扰项 */
  localBuild(sourceText) {
    const scenes = D.PHOTO_SCENES || [];
    const pool = [];
    if (scenes.length) {
      const scene = pick(scenes);
      (scene.items || []).forEach(it => pool.push(it));
    }
    const extra = ['番茄', '鸡蛋', '牛奶', '菠菜', '土豆', '洋葱', '胡萝卜', '青椒', '豆腐', '苹果'];
    for (let i = 0; i < 3; i++) {
      const n = pick(extra);
      if (!pool.some(p => p.name === n)) pool.push({ name: n, qty: 1 });
    }
    const list = pool.slice(0, 6).map(it => {
      const meta = E.foodMeta(it.name);
      return {
        name: it.name,
        score: 0.62 + Math.random() * 0.36,
        emoji: meta.emoji,
        unit: meta.unit || '份',
        shelf: it.shelf || meta.shelf || 7,
        storage: meta.storage || ''
      };
    });
    this.applyResult(list, sourceText);
  },

  syncCount() {
    const n = (this.data.items || []).filter(i => i.checked).length;
    this.setData({ checkedCount: n });
  },

  onToggle(e) {
    const i = parseInt(e.currentTarget.dataset.i, 10);
    const items = this.data.items.slice();
    if (!items[i]) return;
    items[i].checked = !items[i].checked;
    this.setData({ items: items }, () => this.syncCount());
  },

  onQty(e) {
    const i = parseInt(e.currentTarget.dataset.i, 10);
    const d = parseInt(e.currentTarget.dataset.d, 10);
    const items = this.data.items.slice();
    if (!items[i]) return;
    items[i].qty = Math.max(1, Math.min(20, items[i].qty + d));
    this.setData({ items: items });
  },

  onRetake() {
    const self = this;
    privacy.ensure(() => {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        camera: 'back',
        success: (res) => {
          self.setData({ photo: res.tempFiles[0].tempFilePath });
          self.analyze();
        },
        fail: () => {}
      });
    });
  },

  onRescan() {
    this.analyze();
  },

  onConfirm() {
    const picked = (this.data.items || []).filter(i => i.checked);
    if (!picked.length) {
      wx.showToast({ title: '至少选一样', icon: 'none' });
      return;
    }
    try {
      picked.forEach(it => S.add(it.name, it.qty, it.shelf, it.storage));
      S.save();
    } catch (e) {
      wx.showModal({ title: '入库失败', content: String((e && e.message) || e), showCancel: false });
      return;
    }
    wx.showToast({ title: '已入库 ' + picked.length + ' 件', icon: 'success' });
    setTimeout(() => wx.switchTab({ url: '/pages/fridge/index' }), 500);
  },

  onCancel() {
    wx.switchTab({ url: '/pages/fridge/index' });
  }
});
