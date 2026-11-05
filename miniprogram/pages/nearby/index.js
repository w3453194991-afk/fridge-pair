const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    status: '',
    city: '未定位',
    lat: null,
    lng: null,
    advice: '',
    shops: [],
    env: 'develop'
  },

  onLoad() {
    let env = 'develop';
    try {
      const info = wx.getAccountInfoSync();
      env = (info && info.miniProgram && info.miniProgram.envVersion) || 'develop';
    } catch (e) {}
    this.setData({ env: env });

    // 采购建议
    try {
      const missing = {};
      const week = S.state.week || [];
      week.slice(0, 3).forEach(day => {
        Object.keys(day.meals || {}).forEach(k => {
          const m = day.meals[k];
          (m.ids || []).forEach(id => {
            const dish = D.DISHES.filter(x => x.id === id)[0];
            if (!dish) return;
            E.ingredientState(dish, S.state.foods).forEach(s => {
              if (!s.ok) missing[s.name] = (missing[s.name] || 0) + 1;
            });
          });
        });
      });
      const list = Object.keys(missing).sort((a, b) => missing[b] - missing[a]).slice(0, 5);
      this.setData({ advice: list.length ? ('最近要买：' + list.join('、')) : '本周食材基本够用' });
    } catch (e) {}
  },

  /* 定位 */
  onLocate() {
    const self = this;
    wx.getSetting({
      success: (res) => {
        const auth = res.authSetting && res.authSetting['scope.userLocation'];
        if (auth === false) {
          wx.showModal({
            title: '需要位置权限',
            content: '开启后才能找到附近超市。',
            confirmText: '去开启',
            success: (r) => {
              if (r.confirm) wx.openSetting({ success: () => self.doLocate() });
            }
          });
        } else {
          self.doLocate();
        }
      },
      fail: () => self.doLocate()
    });
  },

  doLocate() {
    const self = this;
    this.setData({ status: '定位中…' });
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        self.setData({
          lat: res.latitude,
          lng: res.longitude,
          city: '已定位（' + res.latitude.toFixed(3) + ', ' + res.longitude.toFixed(3) + '）',
          status: ''
        });
        wx.showToast({ title: '定位成功', icon: 'none' });
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '未知错误';
        self.setData({ city: '定位失败', status: '' });
        wx.showModal({
          title: '定位失败',
          content: msg + '\n\n开发者工具里常常拿不到真实定位，请用真机预览或在手机微信里打开。',
          showCancel: false
        });
      }
    });
  },

  /* 地图选点找超市 */
  onMap() {
    const self = this;
    this.setData({ status: '打开地图…' });
    wx.chooseLocation({
      success: (res) => {
        self.setData({
          status: '',
          city: res.name || res.address || '已选择',
          shops: [{
            name: res.name || '所选地点',
            addr: res.address || '',
            lat: res.latitude,
            lng: res.longitude
          }]
        });
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '';
        self.setData({ status: '' });
        if (msg.indexOf('cancel') >= 0) {
          wx.showToast({ title: '已取消', icon: 'none' });
          return;
        }
        wx.showModal({
          title: '地图打不开',
          content: '原因：' + (msg || '未知') +
            '\n\n常见情况：\n1) 开发者工具不支持地图选点，请用真机预览\n2) 未开启位置权限\n3) 小程序后台未开通「位置接口」\n\n可以先用下面的「复制搜索词」去地图 App 搜。',
          showCancel: false
        });
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
      scale: 16,
      fail: (err) => wx.showToast({ title: '导航打开失败', icon: 'none' })
    });
  },

  onCopy() {
    wx.setClipboardData({
      data: '超市 生鲜 菜市场',
      success: () => wx.showToast({ title: '已复制，去地图 App 粘贴', icon: 'none' })
    });
  },

  onPerm() {
    wx.openSetting({});
  }
});
