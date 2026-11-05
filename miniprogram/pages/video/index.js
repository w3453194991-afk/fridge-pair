const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

const HOT = ['番茄炒蛋', '红烧肉', '可乐鸡翅', '糖醋排骨', '宫保鸡丁', '麻婆豆腐',
  '水煮鱼', '鱼香肉丝', '清蒸鲈鱼', '蒜蓉西兰花', '酸辣土豆丝', '地三鲜'];

Page({
  data: {
    q: '',
    kw: '',
    platforms: [],
    hot: []
  },

  onLoad(opt) {
    const q = opt && opt.q ? decodeURIComponent(opt.q) : '番茄炒蛋';
    this.setData({
      q: q,
      kw: q + ' 做法',
      platforms: (D.PLATFORMS || []).map(p => ({
        key: p.key,
        label: p.icon + ' ' + p.name,
        color: p.color || '#12A576'
      })),
      hot: HOT
    });
  },

  sync(q) {
    this.setData({ q: q, kw: q + ' 做法' });
  },

  onInput(e) {
    this.sync(e.detail.value);
  },

  onHot(e) {
    this.sync(e.currentTarget.dataset.n);
  },

  /** 复制搜索词：最可靠，App 内搜索框粘贴 */
  onCopyWord() {
    const kw = (this.data.kw || '').trim();
    if (!kw) return;
    wx.setClipboardData({
      data: kw,
      success: () => {
        wx.showModal({
          title: '搜索词已复制',
          content: '「' + kw + '」\n\n打开抖音 / 小红书 / B站，在搜索框粘贴，出来的就是做菜教程。',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  /** 复制带筛选条件的平台链接 */
  onPlatform(e) {
    const key = e.currentTarget.dataset.key;
    const kw = (this.data.kw || '').trim();
    if (!kw) { wx.showToast({ title: '先输入菜名', icon: 'none' }); return; }
    let url = '';
    try { url = E.videoSearch(key, kw); } catch (err) { url = ''; }
    if (!url || url === '#') { wx.showToast({ title: '生成失败', icon: 'none' }); return; }

    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showModal({
          title: '链接已复制',
          content: '已带上「做法」关键词' + (key === 'bilibili' ? '并限定美食分区' : '') +
            '，粘贴到浏览器地址栏即可。\n\n部分平台网页版需要登录才能看搜索结果，建议优先用上面的「复制搜索词」在 App 内搜。',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  onCopyAll() {
    const kw = (this.data.kw || '').trim();
    if (!kw) return;
    const lines = ['搜索词：' + kw];
    (this.data.platforms || []).forEach(p => {
      let u = '';
      try { u = E.videoSearch(p.key, kw); } catch (e) {}
      lines.push(p.label + '：' + u);
    });
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '搜索词 + 三个链接已复制', icon: 'none' })
    });
  }
});
