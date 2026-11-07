const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let CFG = {};
try { CFG = require('../../config.js') || {}; } catch (e) {}

Page({
  data: {
    loading: true,
    err: '',
    all: [],        // 全部数据
    rows: [],       // 过滤后展示
    keyword: '',
    searching: false
  },

  onShow() {
    this.load();
  },

  load() {
    if (!wx.cloud || !CFG.CLOUD_ENV) {
      this.setData({ loading: false, err: '未配置云开发，无法读取视频库' });
      return;
    }
    const self = this;
    this.setData({ loading: true, err: '' });
    wx.cloud.callFunction({
      name: 'videos',
      data: { action: 'dishes' },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          const raw = d.error || '读取失败';
          const friendly = raw === '未知 action'
            ? '视频库服务还没部署：请在开发者工具里右键 cloudfunctions/videos 点「创建并部署」'
            : raw;
          self.setData({ loading: false, err: friendly, rows: [], all: [] });
          return;
        }
        const all = (d.items || []).map(x => {
          const dish = D.DISHES.filter(y => y.id === x.dishId)[0];
          return {
            dishId: x.dishId,
            name: (dish && dish.name) || x.dishName || '未知菜',
            emoji: (dish && dish.emoji) || '🍽',
            count: x.count || 1,
            views: x.views || 0,
            nick: x.nick || '冰箱用户',
            atText: self.fmtTime(x.at)
          };
        });
        self.setData({ loading: false, all: all, err: '' }, () => self.applyFilter());
      },
      fail: (e) => {
        self.setData({ loading: false, err: '调用失败：' + ((e && e.errMsg) || '') });
      }
    });
  },

  /* 本地筛选：菜名 / 上传者 */
  applyFilter() {
    const kw = String(this.data.keyword || '').trim();
    const all = this.data.all || [];
    if (!kw) {
      this.setData({ rows: all });
      return;
    }
    const rows = all.filter(x =>
      x.name.indexOf(kw) >= 0 ||
      (x.nick || '').indexOf(kw) >= 0
    );
    this.setData({ rows: rows });
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value, searching: !!e.detail.value }, () => this.applyFilter());
  },

  onSearchTap() {
    this.applyFilter();
    wx.hideKeyboard && wx.hideKeyboard();
  },

  onClear() {
    this.setData({ keyword: '', searching: false }, () => this.applyFilter());
  },

  fmtTime(t) {
    if (!t) return '';
    const d = new Date(t);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  },

  onOpen(e) {
    const i = Number(e.currentTarget.dataset.i);
    const it = this.data.rows[i];
    if (!it) return;
    wx.navigateTo({ url: '/pages/player/index?id=' + it.dishId });
  },

  onSearch() {
    wx.navigateTo({ url: '/pages/video/index' });
  },

  onBack() {
    wx.navigateBack();
  }
});
