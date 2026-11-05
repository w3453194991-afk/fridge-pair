const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    city: '未定位',
    lat: null,
    lng: null,
    advice: '',
    shops: []
  },

  onLoad() {
    // 用冰箱里缺的食材给出采购建议
    try {
      const missing = {};
      const week = S.state.week || [];
      week.slice(0, 2).forEach(day => {
        Object.keys(day.meals || {}).forEach(k => {
          (day.meals[k].missing || []).forEach(n => { missing[n] = (missing[n] || 0) + 1; });
        });
      });
      const list = Object.keys(missing).sort((a, b) => missing[b] - missing[a]).slice(0, 4);
      this.setData({ advice: list.length ? ('本周缺：' + list.join('、')) : '本周食材基本够用' });
    } catch (e) {}
  },

  onLocate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ lat: res.latitude, lng: res.longitude, city: '已定位' });
        wx.showToast({ title: '定位成功', icon: 'none' });
      },
      fail: (err) => {
        this.setData({ city: '定位失败（可点下面地图手动找）' });
        wx.showToast({ title: '定位被拒绝', icon: 'none' });
      }
    });
  },

  onMap() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          city: res.name || res.address || '已选择',
          shops: [{
            name: res.name || '所选地点',
            addr: res.address || '',
            lat: res.latitude,
            lng: res.longitude
          }]
        });
      },
      fail: () => {
        wx.showToast({ title: '已取消', icon: 'none' });
      }
    });
  },

  onOpen(e) {
    const s = this.data.shops[e.currentTarget.dataset.i];
    if (!s) return;
    wx.openLocation({
      latitude: s.lat,
      longitude: s.lng,
      name: s.name,
      address: s.addr,
      scale: 16
    });
  },

  onCopy() {
    const text = '超市 生鲜 菜市场';
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制，去地图 App 粘贴', icon: 'none' })
    });
  }
});
