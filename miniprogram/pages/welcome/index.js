const G = require('../../lib/shim.js');
const S = G.DD_STORE;

Page({
  data: {
    line1: '',
    line2: '',
    line3: '',
    typed: false,
    famName: ''
  },

  onLoad() {
    this.timers = [];
    this.leaving = false;

    try {
      S.load();
      // 消费掉欢迎标记，只播一次
      if (S.state.family && S.state.family.firstRun) {
        S.state.family.firstRun = false;
        S.save();
      }
      this.setData({ famName: (S.state.family && S.state.family.name) || '' });
    } catch (e) {}

    const who = this.data.famName && this.data.famName !== '我' ? this.data.famName : '';
    const l1 = who ? (who + '，欢迎来到冰箱对对碰！') : '欢迎来到冰箱对对碰！';
    const l2 = '我是你的冰箱管家，从今天起它归我管了。';
    const l3 = '先加几样食材，开启你的精致生活吧。';

    this.typeLine('line1', l1, 65, () => {
      this.typeLine('line2', l2, 55, () => {
        this.typeLine('line3', l3, 50, () => {
          this.setData({ typed: true });
          this.timers.push(setTimeout(() => this.onGo(), 3000));
        });
      });
    });
  },

  onUnload() {
    (this.timers || []).forEach(clearTimeout);
  },

  typeLine(key, text, speed, done) {
    let i = 0;
    const tick = () => {
      i++;
      const obj = {};
      obj[key] = text.slice(0, i);
      this.setData(obj);
      if (i < text.length) this.timers.push(setTimeout(tick, speed));
      else if (done) done();
    };
    tick();
  },

  go() {
    if (this.leaving) return;
    this.leaving = true;
    (this.timers || []).forEach(clearTimeout);
    let logged = false;
    try {
      S.load();
      logged = !!(S.state.family && S.state.family.loggedIn);
    } catch (e) {}
    if (logged) wx.switchTab({ url: '/pages/fridge/index' });
    else wx.redirectTo({ url: '/pages/login/index' });
  },

  onGo() {
    wx.reLaunch({ url: '/pages/splash/index' });
  },

  onEnter() {
    this.go();
  },

  onAdd() {
    this.leaving = true;
    (this.timers || []).forEach(clearTimeout);
    wx.reLaunch({ url: '/pages/addfood/index' });
  }
});
