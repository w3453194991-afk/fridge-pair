const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

const HOT = ['番茄炒蛋', '红烧肉', '可乐鸡翅', '糖醋排骨', '宫保鸡丁', '麻婆豆腐',
  '水煮鱼', '鱼香肉丝', '清蒸鲈鱼', '蒜蓉西兰花', '酸辣土豆丝', '地三鲜'];

Page({
  data: {
    q: '',
    kw: '',
    hot: [],
    platforms: [],
    copied: ''
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
  }
});
