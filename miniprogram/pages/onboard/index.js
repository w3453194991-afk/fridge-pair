const G = require('../../lib/shim.js');
const LAB = require('../../lib/labels.js');
const D = G.DD_DATA, S = G.DD_STORE;

const ROLES = ['成人', '老人', '幼儿'];
const ROLE_ICON = { '成人': '👨', '老人': '👵', '幼儿': '👶' };

Page({
  data: {
    step: 0,
    famName: '',
    customCond: '',
    members: [{ role: '成人', age: 30, icon: '👨' }],
    allergens: [],
    condList: [],
    systems: [],
    system: 'cn',
    avoidCount: 0,
    condCount: 0,
    tip: ''
  },

  onLoad(q) {
    this.isEdit = !!(q && q.edit === '1');
    this.fromLogin = !!(q && q.from === 'login');
    this.isNewUser = !!(q && q.new === '1');
    if (this.isEdit) wx.setNavigationBarTitle({ title: '家庭档案' });
    const st = S.state || {};
    const fam = st.family || {};

    // 已有档案就预填（中途退出再进来不会丢）
    let members = (fam.members || []).map(m => ({
      role: ROLES.indexOf(m.role) >= 0 ? m.role : '成人',
      age: m.age || 30,
      icon: ROLE_ICON[m.role] || '👨'
    }));
    if (!members.length) members = [{ role: '成人', age: 30, icon: '👨' }];

    const avoid = fam.avoid || [];
    const conds = fam.conditions || [];
    const system = fam.system || 'cn';

    this.setData({
      famName: (fam.name && fam.name !== '我') ? fam.name : '',
      members: members,
      allergens: (D.ALLERGENS || []).map(a => ({ name: a, on: avoid.indexOf(a) >= 0 })),
      condList: (D.CONDITIONS || []).slice(0, 4).map(c => ({
        key: c.key,
        icon: LAB.condIcon(c.key),
        name: LAB.condLabel(c.key),      // 界面显示饮食需求，内部仍存原 key
        note: LAB.condHint(c.key) || c.note || '',
        on: conds.indexOf(c.key) >= 0
      })),
      systems: (D.MEAL_SYSTEMS || []).map(s => ({
        key: s.key,
        label: s.emoji + ' ' + s.name,
        cls: s.key === system ? 'chip on' : 'chip'
      })),
      system: system,
      avoidCount: avoid.length,
      condCount: conds.length
    });
  },

  /* ---------- 第 1 步：成员 ---------- */
  onName(e) {
    this.setData({ famName: e.detail.value });
  },

  addMember() {
    if (this.data.members.length >= 8) return;
    const members = this.data.members.slice();
    members.push({ role: '成人', age: 30, icon: '👨' });
    this.setData({ members: members });
  },

  removeMember() {
    if (this.data.members.length <= 1) return;
    const members = this.data.members.slice();
    members.pop();
    this.setData({ members: members });
  },

  cycleRole(e) {
    const i = Number(e.currentTarget.dataset.i);
    const members = this.data.members.slice();
    const cur = ROLES.indexOf(members[i].role);
    const next = ROLES[(cur + 1) % ROLES.length];
    members[i].role = next;
    members[i].icon = ROLE_ICON[next];
    this.setData({ members: members });
  },

  changeAge(e) {
    const i = Number(e.currentTarget.dataset.i);
    const d = Number(e.currentTarget.dataset.d);
    const members = this.data.members.slice();
    members[i].age = Math.max(1, Math.min(99, (members[i].age || 30) + d));
    this.setData({ members: members });
  },

  /* ---------- 第 2 步：忌口 ---------- */
  toggleAllergen(e) {
    const i = Number(e.currentTarget.dataset.i);
    const list = this.data.allergens.slice();
    list[i].on = !list[i].on;
    this.setData({
      allergens: list,
      avoidCount: list.filter(x => x.on).length
    });
  },

  /* ---------- 第 3 步：饮食注意 + 体系 ---------- */
  toggleCond(e) {
    const i = Number(e.currentTarget.dataset.i);
    const list = this.data.condList.slice();
    list[i].on = !list[i].on;
    this.setData({
      condList: list,
      condCount: list.filter(x => x.on).length
    });
  },

  onCustomCond(e) {
    this.setData({ customCond: e.detail.value });
  },

  pickSystem(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({
      system: key,
      systems: this.data.systems.map(s => ({
        key: s.key,
        label: s.label,
        cls: s.key === key ? 'chip on' : 'chip'
      }))
    });
  },

  /* ---------- 导航 ---------- */
  next() {
    if (this.data.step < 2) {
      this.setData({ step: this.data.step + 1 });
      return;
    }
    this.finish();
  },

  prev() {
    if (this.data.step > 0) this.setData({ step: this.data.step - 1 });
  },

  finish() {
    const st = S.state;
    const oldFam = st.family || {};
    const avoid = this.data.allergens.filter(x => x.on).map(x => x.name);
    const conds = this.data.condList.filter(x => x.on).map(x => x.name);
    // 自定义的：逗号/顿号/空格 分隔多个
    String(this.data.customCond || '').split(/[,，、;；\s]+/).forEach(s => {
      const v = s.trim();
      if (v && conds.indexOf(v) < 0) conds.push(v);
    });

    const fam = {
      openid: oldFam.openid || '',
      phone: oldFam.phone || '',
      name: (this.data.famName || '').trim() || '我',
      members: this.data.members.map((m, i) => ({
        name: i === 0 ? '我' : ('家人' + (i + 1)),
        role: m.role,
        age: m.age,
        gender: ''
      })),
      avoid: avoid,
      conditions: conds,
      system: this.data.system,
      taboos: ''
    };

    try {
      S.saveFamily(fam);
      // 保留登录态
      S.state.family.loggedIn = true;
      if (oldFam.openid) S.state.family.openid = oldFam.openid;
      S.state.family.onboarded = true;
      if (this.isNewUser) S.state.family.firstRun = true;   // 只有真新用户播欢迎话术
      // 新用户从空冰箱开始
      if (!Array.isArray(st.foods) || !S.state.family.__hadData) {
        S.state.foods = S.state.foods || [];
      }
      S.save();
    } catch (e) {
      wx.showModal({ title: '保存失败', content: String((e && e.message) || e), showCancel: false });
      return;
    }

    wx.showToast({ title: '设置完成', icon: 'success' });
    if (this.isEdit) {
      setTimeout(() => wx.navigateBack(), 500);
    } else {
      setTimeout(() => wx.reLaunch({ url: '/pages/splash/index' }), 500);
    }
  },

  onSkip() {
    // 编辑模式下跳过 = 直接返回，不改数据
    if (this.isEdit) {
      wx.navigateBack();
      return;
    }
    // 首次进入跳过：用一份最小档案，保证 registered
    const oldFam = S.state.family || {};
    const fam = {
      openid: oldFam.openid || '',
      phone: oldFam.phone || '',
      name: '我',
      members: [{ name: '我', role: '成人', age: 30, gender: '' }],
      avoid: [],
      conditions: [],
      system: 'cn',
      taboos: ''
    };
    try {
      S.saveFamily(fam);
      S.state.family.loggedIn = true;
      if (oldFam.openid) S.state.family.openid = oldFam.openid;
      S.state.family.onboarded = true;
      if (this.isNewUser) S.state.family.firstRun = true;   // 只有真新用户播欢迎话术
      S.save();
    } catch (e) {}
    wx.reLaunch({ url: '/pages/splash/index' });
  }
});
