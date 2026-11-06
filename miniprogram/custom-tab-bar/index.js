const G = require('../lib/shim.js');
const privacy = require('../lib/privacy.js');

Component({
  data: {
    selected: 0,
    c0: 'tab on', c1: 'tab', c2: 'tab', c3: 'tab'
  },

  methods: {
    setSel(i) {
      this.setData({
        selected: i,
        c0: i == 0 ? 'tab on' : 'tab',
        c1: i == 1 ? 'tab on' : 'tab',
        c2: i == 2 ? 'tab on' : 'tab',
        c3: i == 3 ? 'tab on' : 'tab'
      });
    },

    go(e) {
      const i = parseInt(e.currentTarget.dataset.i, 10);
      if (i === this.data.selected) return;
      const urls = [
        '/pages/fridge/index',
        '/pages/recipe/index',
        '/pages/plan/index',
        '/pages/me/index'
      ];
      wx.switchTab({ url: urls[i] });
    },

    shoot() {
      privacy.ensure(() => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['camera', 'album'],
          camera: 'back',
          success: (res) => {
            const path = res.tempFiles[0].tempFilePath;
            try { wx.setStorageSync('ddm.tempPhoto', path); } catch (e) {}
            wx.navigateTo({ url: '/pages/scan/index' });
          },
          fail: () => {}
        });
      });
    },

    chat() {
      wx.navigateTo({ url: '/pages/chat/index' });
    }
  }
});
