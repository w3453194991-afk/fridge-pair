const G = require('../../lib/shim.js');
const S = G.DD_STORE;

Page({
  data: {
    phone: '',
    code: '',
    sent: false,
    left: 0,
    agreed: true,
    tip: ''
  },

  onLoad() {
    // 已登录直接进首页
    try {
      S.load();
      if (S.state.family.loggedIn) wx.switchTab({ url: '/pages/fridge/index' });
    } catch (e) {}
    this.timer = null;
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },

  onPhone(e) {
    this.setData({ phone: e.detail.value, tip: '' });
  },

  onCode(e) {
    this.setData({ code: e.detail.value, tip: '' });
  },

  onSend() {
    const p = (this.data.phone || '').trim();
    if (!/^1\d{10}$/.test(p)) {
      this.setData({ tip: '手机号要 11 位，以 1 开头' });
      return;
    }
    this.setData({ sent: true, left: 60, tip: '验证码已发送（演示版随便填 6 位，如 123456）' });
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const l = this.data.left - 1;
      if (l <= 0) {
        clearInterval(this.timer);
        this.timer = null;
        this.setData({ left: 0, sent: false });
      } else {
        this.setData({ left: l });
      }
    }, 1000);
  },

  onSubmit() {
    const p = (this.data.phone || '').trim();
    const c = (this.data.code || '').trim();
    if (!/^1\d{10}$/.test(p)) { this.setData({ tip: '手机号要 11 位' }); return; }
    if (c.length < 4) { this.setData({ tip: '验证码至少 4 位' }); return; }

    try {
      S.load();
      S.login(p);
      // 没有家庭档案就建一份默认的，避免登录后空冰箱
      if (!(S.state.family.members || []).length) {
        S.demoFamily();
        S.state.family.phone = p;
        S.state.family.loggedIn = true;
        S.save();
      }
    } catch (e) {
      this.setData({ tip: '登录失败：' + ((e && e.message) || e) });
      return;
    }
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => wx.switchTab({ url: '/pages/fridge/index' }), 500);
  },

  onDemo() {
    try {
      S.load();
      S.demoFamily();
      S.save();
    } catch (e) {}
    wx.showToast({ title: '已进入体验模式', icon: 'none' });
    setTimeout(() => wx.switchTab({ url: '/pages/fridge/index' }), 400);
  },

  onAgree() {
    this.setData({ agreed: !this.data.agreed });
  }
});
