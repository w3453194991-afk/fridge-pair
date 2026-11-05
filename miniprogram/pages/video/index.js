const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

const HOT = ['番茄炒蛋', '红烧肉', '可乐鸡翅', '糖醋排骨', '宫保鸡丁', '麻婆豆腐',
  '水煮鱼', '鱼香肉丝', '清蒸鲈鱼', '蒜蓉西兰花', '酸辣土豆丝', '地三鲜'];

Page({
  data: {
    q: '',
    platforms: [],
    hot: []
  },

  onLoad(opt) {
    const q = opt && opt.q ? decodeURIComponent(opt.q) : '';
    this.setData({
      q: q || '番茄炒蛋',
      platforms: (D.PLATFORMS || []).map(p => ({
        key: p.key,
        label: p.icon + ' ' + p.name,
        color: p.color || '#12A576'
      })),
      hot: HOT
    });
  },

  onInput(e) {
    this.setData({ q: e.detail.value });
  },

  onHot(e) {
    this.setData({ q: e.currentTarget.dataset.n });
  },

  onPlatform(e) {
    const key = e.currentTarget.dataset.key;
    const q = (this.data.q || '').trim();
    if (!q) { wx.showToast({ title: '先输入菜名', icon: 'none' }); return; }
    let url = '';
    try { url = E.videoSearch(key, q); } catch (err) { url = ''; }
    if (!url || url === '#') { wx.showToast({ title: '链接生成失败', icon: 'none' }); return; }

    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showModal({
          title: '搜索链接已复制',
          content: '搜索词：' + q + '\n\n打开浏览器或对应 App，粘贴到地址栏即可看到教程视频。',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  onOpenAll() {
    const q = (this.data.q || '').trim();
    if (!q) return;
    const lines = (this.data.platforms || []).map(p => {
      let u = '';
      try { u = E.videoSearch(p.key, q); } catch (e) {}
      return p.label + '：' + u;
    }).join('\n');
    wx.setClipboardData({ data: lines, success: () => wx.showToast({ title: '三个平台链接都复制了', icon: 'none' }) });
  }
});
