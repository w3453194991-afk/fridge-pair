const G = require('../../lib/shim.js');
const S = G.DD_STORE;
let CFG = {};
try { CFG = require('../../config.js') || {}; } catch (e) {}

Page({
  data: {
    loading: false,
    agreed: true,
    tip: '',
    isDemo: true,
    envVersion: 'develop',
    cloudReady: false,
    openid: ''
  },

  onLoad() {
    let env = 'develop';
    try {
      const info = wx.getAccountInfoSync();
      env = (info && info.miniProgram && info.miniProgram.envVersion) || 'develop';
    } catch (e) {}
    this.setData({
      isDemo: env !== 'release',
      envVersion: env,
      cloudReady: !!(CFG && CFG.CLOUD_ENV)
    });
  },

  onAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  /* 微信一键登录：云函数拿 openid */
  onWechatLogin() {
    if (!this.data.agreed) {
      this.setData({ tip: '请先勾选同意《用户协议》和《隐私政策》' });
      return;
    }
    if (!CFG || !CFG.CLOUD_ENV) {
      this.setData({ tip: '未配置云开发环境，请先在 config.js 填 CLOUD_ENV' });
      return;
    }

    const self = this;
    this.setData({ loading: true, tip: '' });

    wx.cloud.callFunction({
      name: 'login',
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.openid) {
          self.setData({ loading: false, tip: '登录失败：没拿到 openid' });
          return;
        }
        self.finishLogin(d.openid);
      },
      fail: (err) => {
        self.setData({
          loading: false,
          tip: '云函数调用失败：' + ((err && err.errMsg) || '未知')
        });
      }
    });
  },

  finishLogin(openid) {
    try {
      S.load();
      // 首次登录：建一份默认家庭档案
      if (!(S.state.family.members || []).length) {
        S.demoFamily();
      }
      S.state.family.openid = openid;
      S.state.family.loggedIn = true;
      S.state.family.phone = S.state.family.phone || '';
      S.state.family.loginAt = Date.now();
      S.save();
      this.setData({ openid: openid, loading: false });
    } catch (e) {
      this.setData({ loading: false, tip: '保存失败：' + ((e && e.message) || e) });
      return;
    }
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => wx.reLaunch({ url: '/pages/splash/index' }), 500);
  },

  /* 开发/体验版专用：跳过登录 */
  onDemo() {
    try {
      S.load();
      S.demoFamily();
      S.state.family.loggedIn = true;
      S.save();
    } catch (e) {}
    wx.showToast({ title: '已进入体验模式', icon: 'none' });
    setTimeout(() => wx.reLaunch({ url: '/pages/splash/index' }), 400);
  }
});
