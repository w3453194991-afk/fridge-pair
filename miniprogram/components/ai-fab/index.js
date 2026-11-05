const KEY = 'ddm.fab';

Component({
  data: {
    fx: 240,
    fy: 240
  },

  lifetimes: {
    attached() {
      try {
        const pos = wx.getStorageSync(KEY);
        if (pos && typeof pos.x === 'number') {
          this.setData({ fx: pos.x, fy: pos.y });
        }
      } catch (e) {}
    }
  },

  methods: {
    onChat() {
      wx.navigateTo({ url: '/pages/chat/index' });
    },

    onMove(e) {
      const d = e.detail;
      if (!d || d.source !== 'touch') return;
      this.lastPos = { x: d.x, y: d.y };
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        try { wx.setStorageSync(KEY, this.lastPos); } catch (err) {}
      }, 400);
    }
  }
});
