const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
const SYNC = require('../../lib/sync.js');
let CFG = {};
try { CFG = require('../../config.js') || {}; } catch (e) {}

Page({
  data: {
    famName: '',
    memberCount: 0,
    foodCount: 0,
    openidShort: '',
    cloudMode: '未开启',
    syncText: '',
    scanUsed: 0,
    scanLimit: 0,
    version: '1.0.0',
    hasAgreement: false
  },

  onShow() {
    this.render();
  },

  render() {
    const st = S.state || {};
    const fam = st.family || {};
    const c = E.counts(st.foods || []);
    const total = c.g + c.y + c.p + c.b;

    let syncText = '本地存储';
    let cloudMode = '未开启';
    if (CFG && CFG.CLOUD_ENV) {
      cloudMode = '已开启';
      const s = SYNC.status();
      if (!s.attached) syncText = '登录后自动同步';
      else if (s.lastErr) syncText = '上次同步失败：' + s.lastErr;
      else syncText = '已同步到云端';
    }

    // 今日识别次数
    let used = 0;
    try {
      const raw = wx.getStorageSync('ddm.quota.scan');
      const d = new Date();
      const today = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      if (raw && raw.day === today) used = raw.n || 0;
    } catch (e) {}

    const openid = fam.openid || '';

    this.setData({
      famName: fam.name || '我',
      memberCount: (fam.members || []).length,
      foodCount: total,
      openidShort: openid ? (openid.slice(0, 8) + '…' + openid.slice(-4)) : '未登录',
      cloudMode: cloudMode,
      syncText: syncText,
      scanUsed: used,
      scanLimit: Number(CFG.DAILY_SCAN_LIMIT) || 0
    });
  },

  /* 账号 */
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
        try { S.state.family.name = v; S.save(); } catch (e) {}
        this.render();
      }
    });
  },

  onFamily() {
    wx.navigateTo({ url: '/pages/onboard/index?edit=1' });
  },

  /* 数据 */
  onManualSync() {
    if (!(CFG && CFG.CLOUD_ENV)) {
      wx.showToast({ title: '未开启云开发', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '同步中' });
    SYNC.flush().then((r) => {
      wx.hideLoading();
      wx.showToast({ title: r && r.ok ? '已同步' : '同步失败', icon: 'none' });
      this.render();
    });
  },

  onResetQuota() {
    try {
      wx.removeStorageSync('ddm.quota.scan');
      wx.removeStorageSync('ddm.quota.chat');
    } catch (e) {}
    this.render();
    wx.showToast({ title: '今日次数已重置', icon: 'none' });
  },

  onClearLocal() {
    wx.showModal({
      title: '清除本地缓存',
      content: '只清手机上的缓存，云端数据保留。下次登录会重新拉取。',
      success: (res) => {
        if (!res.confirm) return;
        try {
          wx.removeStorageSync('fridge.ddm.v1');
        } catch (e) {}
        wx.showToast({ title: '已清除', icon: 'none' });
      }
    });
  },

  /* 关于 */
  onAbout() {
    wx.showModal({
      title: '冰箱对对碰',
      content: '版本 ' + this.data.version + '\n\nAI 全生命周期 · 家庭食材管理\n四色临期分级 / 营养配餐 / 聚餐规划 / 拍照识别\n\n菜品与营养建议仅供参考，不构成医疗建议。',
      showCancel: false
    });
  },

  onPrivacy() {
    wx.showModal({
      title: '隐私说明',
      content: '· 我们仅使用微信身份标识（openid）区分账号\n· 相机/相册：仅用于拍摄食材做识别\n· 位置：仅在你点击「附近超市」时使用\n· 数据保存在你的账号下，不会分享给第三方',
      showCancel: false
    });
  },

  /* 退出 */
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录。云端数据不会删除。',
      success: (res) => {
        if (!res.confirm) return;
        try { S.logout(); S.save(); } catch (e) {}
        wx.reLaunch({ url: '/pages/login/index' });
      }
    });
  }
});
