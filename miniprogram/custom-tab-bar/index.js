const G = require('../lib/shim.js');

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
      const S = G.DD_STORE;
      const D = G.DD_DATA;
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        success: () => {
          const scenes = D.PHOTO_SCENES || [];
          const scene = scenes[Math.floor(Math.random() * scenes.length)];
          if (scene) {
            scene.items.forEach(it => S.add(it.name, it.qty, it.shelf));
          }
          wx.showToast({ title: scene ? ('识别到 ' + scene.items.length + ' 件，已入库') : '已拍照', icon: 'none' });
          wx.switchTab({ url: '/pages/fridge/index' });
        },
        fail: () => {}
      });
    },

    chat() {
      wx.navigateTo({ url: '/pages/chat/index' });
    }
  }
});
