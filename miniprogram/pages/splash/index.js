const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    phase: 0,           // 0 开机 1 机器人
    lines: [],
    line1: '', line2: '', line3: '',
    hasUrgent: false,
    urgentN: 0,
    canSkip: false
  },

  onLoad() {
    this.timers = [];
    const goto = () => {
      try { S.load(); } catch (e) {}
      const logged = S.state && S.state.family && S.state.family.loggedIn;
      if (logged) wx.switchTab({ url: '/pages/fridge/index' });
      else wx.redirectTo({ url: '/pages/login/index' });
    };

    // 开机阶段 1.6s，随后进入机器人
    this.timers.push(setTimeout(() => {
      this.setData({ phase: 1, canSkip: true });
      this.speak();
    }, 1650));

    // 兜底：6s 后自动进入
    this.timers.push(setTimeout(goto, 6500));
  },

  onUnload() {
    (this.timers || []).forEach(clearTimeout);
  },

  speak() {
    try {
      const st = S.state;
      const urgent = E.urgentList(st.foods).slice(0, 3);
      const names = urgent.map(f => f.name).join('、');
      const l1 = urgent.length
        ? ('嘀嘀——发现 ' + urgent.length + ' 件临期食材！')
        : '嘀嘀——冰箱状态满分！';
      const l2 = urgent.length
        ? (names + ' 快到期了，快吃掉！快吃掉！')
        : '今天想吃点什么？我帮你搭配。';
      const l3 = urgent.length ? '点下面按钮，我帮你排今天的菜' : '进来看看吧';

      this.setData({
        hasUrgent: urgent.length > 0,
        urgentN: urgent.length,
        line1: '', line2: '', line3: ''
      });
      this.typeLine('line1', l1, 60, () => {
        this.typeLine('line2', l2, 55, () => {
          this.typeLine('line3', l3, 50, () => {});
        });
      });
    } catch (e) {}
  },

  typeLine(key, text, speed, done) {
    let i = 0;
    const tick = () => {
      i++;
      const obj = {};
      obj[key] = text.slice(0, i);
      this.setData(obj);
      if (i < text.length) {
        this.timers.push(setTimeout(tick, speed));
      } else if (done) {
        done();
      }
    };
    tick();
  },

  next() {
    let logged = false;
    try {
      S.load();
      logged = !!(S.state && S.state.family && S.state.family.loggedIn);
    } catch (e) {}
    if (logged) wx.switchTab({ url: '/pages/fridge/index' });
    else wx.redirectTo({ url: '/pages/login/index' });
  },

  onSkip() {
    this.next();
  },

  onGo() {
    if (this.data.hasUrgent) {
      try {
        const st = S.state;
        st.week = E.planWeek(st);
        S.save();
      } catch (e) {}
    }
    this.next();
  }
});
