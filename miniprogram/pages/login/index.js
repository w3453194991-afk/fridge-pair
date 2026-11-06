const G = require('../../lib/shim.js');
const S = G.DD_STORE;
const SYNC = require('../../lib/sync.js');
const SESSION = require('../../lib/session.js');
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
      const fam = S.state.family || (S.state.family = {});
      const isNew = !fam.registered;

      fam.openid = openid;
      fam.loggedIn = true;
      fam.phone = fam.phone || '';
      fam.loginAt = Date.now();

      // 新用户：从空冰箱开始，不塞示例数据
      if (isNew) {
        S.state.foods = [];
        S.state.cart = [];
        S.state.week = null;
        S.state.stats = { cooked: 0, saved: 0, added: 0, trashed: 0 };
      }
      S.save();
      this.setData({ openid: openid, loading: false });
    } catch (e) {
      this.setData({ loading: false, tip: '保存失败：' + ((e && e.message) || e) });
      return;
    }

    // 只跳一次（之前 pull 回调和兜底 timeout 都会触发，导致开屏动画播两遍）
    let gone = false;
    const route = () => {
      if (gone) return;
      gone = true;

      // 云端拉回来的「我的菜谱」要重新挂进菜谱库，否则聚餐/配餐看不到
      try {
        if (G.DD_ENGINE && G.DD_ENGINE.attachCustom && Array.isArray(S.state.custom) && S.state.custom.length) {
          G.DD_ENGINE.attachCustom(S.state.custom);
        }
      } catch (e) {}

      const f = S.state.family || {};
      // 只要已经有家庭成员，就认为档案已建好 —— 不必依赖 onboarded 标记（它可能被云端旧值覆盖）
      const hasFamily = !!(f.members && f.members.length);
      const needsOnboard = !f.onboarded && !hasFamily;

      // 额外存一份轻量会话，防止主存储被清后回登录页
      try { SESSION.save(S.state.family, S.state.family.openid || ''); } catch (e) {}

      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        // 只有第一次登录、且还没有家庭档案时才进引导页
        if (needsOnboard) {
          wx.reLaunch({ url: '/pages/onboard/index?from=login&new=1' });
        } else {
          wx.reLaunch({ url: '/pages/splash/index' });
        }
      }, 400);
    };

    try {
      if (CFG && CFG.CLOUD_ENV) {
        SYNC.attach(S);
        SYNC.pull(S).then(route, route);
        setTimeout(route, 2000);       // 网络慢也不卡住，route 幂等
        return;
      }
    } catch (e) {}
    route();
  },

  /* 开发/体验版专用：跳过登录（不建家庭档案，进首页后可手动添加） */
  onDemo() {
    try {
      S.load();
      S.state.family.loggedIn = true;
      if (!S.state.family.openid) S.state.family.openid = 'demo-' + Date.now();
      S.save();
    } catch (e) {}
    wx.showToast({ title: '已进入体验模式', icon: 'none' });
    setTimeout(() => wx.reLaunch({ url: '/pages/splash/index' }), 400);
  }
});
