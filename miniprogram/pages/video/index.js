const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let P = {};
try { P = require('../../lib/photos.js') || {}; } catch (e) { P = {}; }

Page({
  data: {
    list: [],
    q: '',
    platforms: []
  },

  onLoad(opt) {
    const list = [];
    Object.keys(D.VIDEOS || {}).forEach(id => {
      const d = D.DISHES.filter(x => x.id === id)[0];
      if (!d) return;
      (D.VIDEOS[id] || []).forEach((v, i) => {
        list.push({
          key: id + '_' + i,
          dishId: id,
          name: d.name,
          emoji: d.emoji,
          minutes: d.minutes,
          title: v.title || (d.name + ' 做法'),
          bvid: v.bvid,
          photo: P[id] ? ('/img/' + id + '.jpg') : ''
        });
      });
    });

    const platforms = (D.PLATFORMS || []).map(p => ({
      key: p.key,
      label: p.icon + ' ' + p.name,
      cls: 'chip'
    }));

    this.setData({
      list: list,
      platforms: platforms,
      q: opt && opt.q ? decodeURIComponent(opt.q) : ''
    });
  },

  onPlay(e) {
    const bvid = e.currentTarget.dataset.bvid;
    wx.navigateTo({ url: '/pages/player/index?bvid=' + bvid });
  },

  onCopy(e) {
    const bvid = e.currentTarget.dataset.bvid;
    let url = '';
    try { url = E.videoPage(bvid); } catch (err) { url = 'https://www.bilibili.com/video/' + bvid; }
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制', icon: 'none' })
    });
  },

  onQ(e) {
    this.setData({ q: e.detail.value });
  },

  onPlatform(e) {
    const key = e.currentTarget.dataset.key;
    const q = (this.data.q || '').trim() || '番茄炒蛋';
    let url = '';
    try { url = E.videoSearch(key, q); } catch (err) { url = ''; }
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '搜索链接已复制', icon: 'none' })
    });
  }
});
