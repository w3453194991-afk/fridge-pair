const G = require('../../lib/shim.js');
const E = G.DD_ENGINE;

Page({
  data: { url: '' },

  onLoad(q) {
    const bvid = q.bvid || '';
    let url = '';
    try { url = E.videoEmbed(bvid); } catch (e) { url = ''; }
    this.setData({ url: url });
    this.bvid = bvid;
  },

  onCopy() {
    let page = '';
    try { page = E.videoPage(this.bvid); } catch (e) { page = ''; }
    wx.setClipboardData({
      data: page,
      success: () => wx.showToast({ title: '链接已复制，去 B 站打开', icon: 'none' })
    });
  }
});
