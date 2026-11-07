const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    dish: null,
    src: '',
    loading: true,
    err: ''
  },

  onLoad(opt) {
    const id = (opt && opt.id) || '';
    const d = D.DISHES.filter(x => x.id === id)[0];
    if (!d) {
      this.setData({ loading: false, err: '没找到这道菜' });
      return;
    }
    // videos 里可能混着旧的 B 站条目（对象），只取能直接播放的字符串
    const vids = (d.videos || []).filter(v => typeof v === 'string' && v);
    this.setData({ dish: { name: d.name, emoji: d.emoji }, loading: false });

    if (!vids.length) return;

    const first = vids[0];
    // 云存储文件要先换临时链接
    if (String(first).indexOf('cloud://') === 0 && wx.cloud) {
      wx.cloud.getTempFileURL({
        fileList: [first],
        success: (r) => {
          const f = (r.fileList || [])[0];
          if (f && f.tempFileURL) this.setData({ src: f.tempFileURL });
          else this.setData({ err: '视频链接获取失败' });
        },
        fail: () => this.setData({ err: '云存储读取失败，检查是否已上传' })
      });
    } else {
      this.setData({ src: first });
    }
  },

  onError() {
    this.setData({ err: '这个视频打不开，可能链接失效或域名未配置' });
  },

  onBack() {
    wx.navigateBack();
  }
});
