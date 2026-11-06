const G = require('../../lib/shim.js');
const SESSION = require('../../lib/session.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    phase: 0,           // 0 开机 1 机器人
    lines: [],
    line1: '', line2: '', line3: '',
    hasUrgent: false,
    urgentN: 0,
    canSkip: false,
    typed: false,
    isWelcome: false
  },

  onLoad() {
    this.timers = [];
    this.leaving = false;

    // 没登录过 → 直接去登录页，不放开场动画
    try {
      S.load();

      // 主存储丢了登录态时，用轻量会话兜底恢复，避免每次都回登录页
      if (!(S.state.family && S.state.family.loggedIn)) {
        const ses = SESSION.read();
        if (ses) {
          try {
            if (ses.fam) {
              S.state.family = Object.assign({}, S.state.family || {}, ses.fam, { loggedIn: true });
            } else {
              S.state.family.loggedIn = true;
            }
            if (ses.openid) S.state.family.openid = ses.openid;
            S.save();
            console.log('[session] 已用会话恢复登录态');
          } catch (e) {}
        }
      }

      const logged = S.state && S.state.family && S.state.family.loggedIn;
      if (!logged) {
        this.leaving = true;
        wx.redirectTo({ url: '/pages/login/index' });
        return;
      }

      // 登录了但家庭档案还没建（比如在引导页中途退出）→ 补一次引导
      const fam = S.state.family || {};
      if (!fam.onboarded && !(fam.members || []).length) {
        this.leaving = true;
        wx.redirectTo({ url: '/pages/onboard/index?from=login&new=1' });
        return;
      }
    } catch (e) {}

    this.goto = () => {
      if (this.leaving) return;
      this.leaving = true;
      this.timers.forEach(clearTimeout);
      try {
        S.load();
        // 首次欢迎播完就消费掉标记
        if (S.state.family && S.state.family.firstRun) {
          S.state.family.firstRun = false;
          S.save();
        }
      } catch (e) {}
      const logged = S.state && S.state.family && S.state.family.loggedIn;
      if (logged) wx.switchTab({ url: '/pages/fridge/index' });
      else wx.redirectTo({ url: '/pages/login/index' });
    };

    // 首次欢迎：跳过开机动画，直接进机器人欢迎页，确保一定看得到
    let isWelcome = false;
    try { isWelcome = !!(S.state.family && S.state.family.firstRun); } catch (e) {}
    this.isWelcome = isWelcome;

    if (isWelcome) {
      // 欢迎页是独立页面，这里直接送过去
      this.leaving = true;
      wx.redirectTo({ url: '/pages/welcome/index' });
      return;
    }
    {
      // 普通启动：开机阶段 1.65s，随后进入机器人
      this.timers.push(setTimeout(() => {
        this.setData({ phase: 1, canSkip: true });
        this.speak();
      }, 1650));
    }

    // 硬兜底：万一打字卡住，15s 后也要进得去（正常由台词说完触发）
    this.timers.push(setTimeout(this.goto, isWelcome ? 20000 : 15000));
  },

  onUnload() {
    (this.timers || []).forEach(clearTimeout);
  },

  speak() {
    try {
      const st = S.state;
      const foods = st.foods || [];
      const urgent = E.urgentList(foods).slice(0, 3);
      const names = urgent.map(f => f.name).join('、');

      let l1, l2, l3;
      const firstRun = !!(st.family && st.family.firstRun);
      if (firstRun) {
        l1 = '欢迎来到冰箱对对碰！';
        l2 = '我是你的冰箱管家，从今天起它归我管了。';
        l3 = '先加几样食材，开启你的精致生活吧。';
      } else if (!foods.length) {
        l1 = '嘀嘀——冰箱还是空的！';
        l2 = '先拍一张照片，我帮你把食材记进去。';
        l3 = '点一下中间的相机就行';
      } else if (urgent.length) {
        l1 = '嘀嘀——发现 ' + urgent.length + ' 件临期食材！';
        l2 = names + ' 快到期了，快吃掉！快吃掉！';
        l3 = '点下面按钮，我帮你排今天的菜';
      } else {
        l1 = '嘀嘀——冰箱状态满分！';
        l2 = '今天想吃点什么？我帮你搭配。';
        l3 = '进来看看吧';
      }

      this.setData({
        firstRun: firstRun,
        isEmpty: !foods.length,
        hasUrgent: urgent.length > 0,
        urgentN: urgent.length,
        line1: '', line2: '', line3: ''
      });
      this.typeLine('line1', l1, 60, () => {
        this.typeLine('line2', l2, 55, () => {
          this.typeLine('line3', l3, 50, () => {
            // 机器人说完、按钮出现，再停留 2.6 秒自动进首页
            this.setData({ typed: true });
            this.timers.push(setTimeout(() => this.goto(), 2600));
          });
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
