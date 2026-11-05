const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: { fam: null, members: [], avoid: [], conditions: [], stats: {}, health: 0, total: 0 },

  onShow() { this.render(); },

  render() {
    const st = S.state;
    const c = E.counts(st.foods);
    const total = c.g + c.y + c.p + c.b;
    // 健康分：充足占比越高越健康
    const health = total ? Math.round((c.g / total) * 100) : 0;
    this.setData({
      fam: st.family,
      members: st.family.members || [],
      avoid: st.family.avoid || [],
      conditions: st.family.conditions || [],
      stats: { cooked: (st.stats && st.stats.cooked) || 0, saved: (st.stats && Math.round(st.stats.saved)) || 0 },
      health: health,
      total: total
    });
  },

  onTravel() {
    S.travel(3);
    this.render();
    wx.showToast({ title: '时间 +3 天，颜色会变', icon: 'none' });
  },

  onReset() {
    wx.showModal({
      title: '重置演示数据',
      content: '会清空库存与菜单，恢复成初始示例冰箱。确定吗？',
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

  onHealth() {
    wx.showModal({
      title: '健康档案',
      content: '过敏原：' + (this.data.avoid.join('、') || '未设置') +
        '\n疾病史：' + (this.data.conditions.join('、') || '未设置') +
        '\n\n完整编辑在 web 版「我的 → 健康档案」。',
      showCancel: false
    });
  },

  onAbout() {
    wx.showModal({
      title: '冰箱对对碰 · 小程序版',
      content: '与 web 版共用同一套核心（食材库 254 · 菜谱 68 · 四色保质期 · 营养配餐）。\n' +
        '视频播放、附近超市、开屏动画在 web 版体验更完整。',
      showCancel: false
    });
  }
});
