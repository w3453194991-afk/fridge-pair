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
    imgErr: false,
    errText: '',
    scanning: true,
    items: [],
    checkedCount: 0,
    round: 0,
    sourceText: '',
    sourceCls: 'src'
  },

  onImgError() {
    console.warn('[scan] 图片加载失败，路径可能已失效');
    this.setData({ imgErr: true });
  },

  onLoad(q) {
    let photo = (q && q.photo) ? decodeURIComponent(q.photo) : '';
    if (!photo) {
      try { photo = wx.getStorageSync('ddm.tempPhoto') || ''; } catch (e) {}
    }
    // 只接受本地临时文件/包内路径，其它一律视为无效
    if (photo && !/^(wxfile:|http:\/\/tmp|\/|data:image)/.test(photo)) photo = '';
    this.setData({ photo: photo });

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

  /* 优先走云函数 → HTTP 中转 → （可选）本地演示 */
  analyze() {
    const self = this;
    this.setData({ scanning: true, sourceText: '', errText: '' });

    if (!this.data.photo) {
      this.showError('没拿到照片，请重拍一张');
      return;
    }

    let fs = null;
    try { fs = wx.getFileSystemManager(); } catch (e) { fs = null; }
    if (!fs) {
      this.showError('当前环境无法读取图片');
      return;
    }

    fs.readFile({
      filePath: this.data.photo,
      encoding: 'base64',
      success: (r) => self.recognize(r.data),
      fail: (err) => self.showError('读图失败：' + ((err && err.errMsg) || ''))
    });
  },

  /* 明确的失败态：不给假结果 */
  showError(msg) {
    const allowMock = !!CONFIG.ALLOW_MOCK;
    if (allowMock) {
      this.localBuild('演示识别（离线模式）');
      return;
    }
    this.setData({
      scanning: false,
      items: [],
      errText: msg || '识别服务未连接',
      sourceText: ''
    });
  },

  onRetry() {
    if (!this.data.photo) {
      this.onRetake();
      return;
    }
    this.analyze();
  },

  onManualAdd() {
    wx.navigateTo({ url: '/pages/addfood/index' });
  },

  recognize(base64) {
    const self = this;
    this.lastBase64 = base64;

    /* ① 云函数 */
    if (CONFIG.USE_CLOUD && CONFIG.CLOUD_ENV && wx.cloud) {
      wx.cloud.callFunction({
        name: 'recognize',
        data: { image: base64 },
        success: (res) => {
          const d = (res && res.result) || {};
          const list = Array.isArray(d.items) ? d.items : [];
          if (!list.length) {
            self.showError(d.error ? ('识别失败：' + d.error) : '识别没有返回结果');
            return;
          }
          self.applyResult(list, d.source === 'baidu' ? '百度 AI 识别（云函数）' : '云函数演示识别');
        },
        fail: (err) => {
          const msg = (err && err.errMsg) || '未知错误';
          console.warn('[scan] 云函数失败', msg);
          // 有 HTTP 中转就再试一次，否则直接报错
          if (CONFIG.USE_REMOTE && CONFIG.API_BASE) self.httpTry(base64, msg);
          else self.showError('云函数调用失败：' + msg);
        }
      });
      return;
    }

    if (CONFIG.USE_REMOTE && CONFIG.API_BASE) {
      this.httpTry(base64, '');
      return;
    }

    this.showError('没有可用的识别服务（未配置云开发或中转地址）');
  },

  httpTry(base64, prevErr) {
    const self = this;
    wx.request({
      url: CONFIG.API_BASE.replace(/\/$/, '') + '/recognize',
      method: 'POST',
      timeout: CONFIG.TIMEOUT || 15000,
      header: { 'content-type': 'application/json' },
      data: { image: base64 },
      success: (res) => {
        const d = (res && res.data) || {};
        const list = Array.isArray(d.items) ? d.items : [];
        if (!list.length) {
          self.showError(d.error ? ('识别失败：' + d.error) : '识别没有返回结果');
          return;
        }
        self.applyResult(list, d.source === 'baidu' ? '百度 AI 识别' : '服务端识别');
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '未知错误';
        console.warn('[scan] 请求失败', msg);
        self.showError((prevErr ? ('云函数失败：' + prevErr + '\n') : '') + '中转服务连接失败：' + msg);
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
