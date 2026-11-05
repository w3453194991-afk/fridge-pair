const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

Page({
  data: {
    photo: '',
    scanning: true,
    items: [],
    checkedCount: 0,
    round: 0
  },

  onLoad(q) {
    this.setData({ photo: (q && q.photo) || '' });
    this.skip = q && q.skip === '1';
    if (this.skip) {
      this.setData({ scanning: false });
      this.build();
    } else {
      setTimeout(() => {
        this.setData({ scanning: false });
        this.build();
      }, 1100);
    }
  },

  /* 生成一批候选（演示识别：从场景库取一组，再混入干扰项） */
  build() {
    const scenes = D.PHOTO_SCENES || [];
    const pool = [];
    if (scenes.length) {
      const scene = pick(scenes);
      (scene.items || []).forEach(it => pool.push(it));
    }
    // 再加几样"冰箱常见"的干扰项，模拟识别候选
    const extra = ['番茄', '鸡蛋', '牛奶', '菠菜', '土豆', '洋葱', '胡萝卜', '青椒', '豆腐', '苹果'];
    for (let i = 0; i < 3; i++) {
      const n = pick(extra);
      if (!pool.some(p => p.name === n)) {
        pool.push({ name: n, qty: 1 });
      }
    }

    const items = pool.slice(0, 6).map((it, i) => {
      const meta = E.foodMeta(it.name);
      const conf = Math.round((0.62 + Math.random() * 0.36) * 100);
      return {
        idx: i,
        name: it.name,
        emoji: meta.emoji,
        unit: meta.unit || '份',
        qty: it.qty || 1,
        shelf: it.shelf || meta.shelf || 7,
        storage: it.storage || meta.storage || '',
        conf: conf,
        checked: conf >= 70
      };
    });

    this.setData({ items: items, round: this.data.round + 1 }, () => this.syncCount());
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
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      camera: 'back',
      success: (res) => {
        self.setData({ photo: res.tempFiles[0].tempFilePath, scanning: true });
        setTimeout(() => {
          self.setData({ scanning: false });
          self.build();
        }, 1100);
      },
      fail: () => {}
    });
  },

  onRescan() {
    this.setData({ scanning: true });
    setTimeout(() => {
      this.setData({ scanning: false });
      this.build();
    }, 800);
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
  },

  onDishAll() {
    this.setData({ items: this.data.items.map(i => (i.checked = true, i)) }, () => this.syncCount());
  }
});
