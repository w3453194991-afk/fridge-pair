const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    famName: '',
    memberRows: [],
    memberCount: 0,
    avoidText: '未设置',
    condText: '未设置',
    cooked: 0,
    saved: 0,
    health: 0,
    total: 0
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSel(3); this.render(); },

  render() {
    const st = S.state;
    const c = E.counts(st.foods);
    const total = c.g + c.y + c.p + c.b;
    const health = total ? Math.round((c.g / total) * 100) : 0;
    const avoid = st.family.avoid || [];
    const conds = st.family.conditions || [];
    const members = st.family.members || [];

    this.setData({
      famName: st.family.name || '我',
      memberCount: members.length,
      memberRows: members.map((m, i) => ({
        idx: i,
        label: (m.name || ('家人' + (i + 1))) + ' · ' + m.role,
        age: m.age + ' 岁'
      })),
      avoidText: avoid.length ? avoid.join('、') : '未设置',
      condText: conds.length ? conds.join('、') : '未设置',
      cooked: (st.stats && st.stats.cooked) || 0,
      saved: (st.stats && Math.round(st.stats.saved)) || 0,
      health: health,
      total: total
    });
  },

  onChat() {
    wx.navigateTo({ url: '/pages/chat/index' });
  },

  onEditName() {
    const cur = (S.state.family && S.state.family.name) || '';
    wx.showModal({
      title: '改个称呼',
      editable: true,
      placeholderText: '比如：林妈妈',
      content: cur === '我' ? '' : cur,
      success: (res) => {
        if (!res.confirm) return;
        const v = String(res.content || '').trim();
        if (!v) return;
        try {
          S.state.family.name = v;
          S.save();
        } catch (e) {}
        this.render();
        wx.showToast({ title: '已更新', icon: 'none' });
      }
    });
  },

  onNearby() {
    wx.navigateTo({ url: '/pages/nearby/index' });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录才能继续使用。',
      success: (res) => {
        if (!res.confirm) return;
        try { S.logout(); S.save(); } catch (e) {}
        wx.reLaunch({ url: '/pages/login/index' });
      }
    });
  },

  onTravel() {
    S.travel(3);
    this.render();
    wx.showToast({ title: '时间 +3 天', icon: 'none' });
  },

  onReset() {
    wx.showModal({
      title: '重置演示数据',
      content: '会清空库存与菜单，恢复初始示例冰箱。',
      success: (res) => {
        if (!res.confirm) return;
        S.reset();
        S.demoFamily();
        S.save();
        this.render();
        wx.showToast({ title: '已重置', icon: 'none' });
      }
    });
  },

  /* 清空冰箱：回到真实的"空"状态 */
  onClearFridge() {
    wx.showModal({
      title: '清空冰箱',
      content: '会移除所有食材和菜单，家庭档案保留。',
      success: (res) => {
        if (!res.confirm) return;
        try {
          S.state.foods = [];
          S.state.week = null;
          S.state.cart = [];
          S.state.stats = { cooked: 0, saved: 0, added: 0, trashed: 0 };
          S.save();
        } catch (e) {}
        this.render();
        wx.showToast({ title: '已清空', icon: 'none' });
      }
    });
  },

  onHealth() {
    wx.showModal({
      title: '健康档案',
      content: '过敏原：' + this.data.avoidText + '\n疾病史：' + this.data.condText,
      showCancel: false
    });
  },

  onAbout() {
    wx.showModal({
      title: '冰箱对对碰 · 小程序版',
      content: '与 web 版共用核心：食材 254 · 菜谱 68 · 四色保质期 · 营养配餐。',
      showCancel: false
    });
  }
});
