const G = require('../../lib/shim.js');
const privacy = require('../../lib/privacy.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let P = {};
try { P = require('../../lib/photos.js') || {}; } catch (e) { P = {}; }

/* 只接受来自本地临时文件、云文件或包内路径的图片，挡掉历史坏数据 */
function validPhoto(p) {
  if (!p || typeof p !== 'string') return false;
  if (p.indexOf('store/') === 0) return false;             // 坏数据（缺 scheme）
  if (p.indexOf('../') === 0) return false;
  return /^(wxfile:|http:\/\/tmp|https:\/\/|cloud:\/\/|\/|data:image)/.test(p);
}

Page({
  data: {
    tab: 'fit',
    tabs: [],
    q: '',
    fitRows: [],
    nearRows: [],
    allRows: [],
    pairRows: [],
    total: 0,
    cuisineCount: 0,
    fitCount: 0,
    cuisine: 'all',
    cuisineChips: [],
    meal: 'all',
    mealChips: [],
    filterTitle: ''
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSel(1);
    this.render();
  },

  render() {
    const foods = S.state.foods;
    const tab = this.data.tab;
    const pinned = S.state.pinned || [];

    const tabs = [
      { key: 'fit', label: '用我的食材做' },
      { key: 'all', label: '全部菜谱' },
      { key: 'video', label: '视频做菜' },
      { key: 'pair', label: '相生相克' }
    ].map(t => ({ key: t.key, label: t.label, cls: t.key === tab ? 'chip on' : 'chip' }));

    const cookable = E.cookable(foods);
    const near = E.nearMiss(foods).slice(0, 6);

    const row = (d, extra) => {
      const ok = E.ingredientState(d, foods).every(s => s.ok);
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        sub: (d.ingredients || []).map(i => i.name).join(' + '),
        ok: ok,
        needText: (extra && extra.need) ? ('还差 ' + extra.need.emoji + ' ' + extra.need.name) : '',
        pinCls: pinned.indexOf(d.id) >= 0 ? 'rd-pin on' : 'rd-pin',
        m1: '⏱ ' + d.minutes + ' 分钟',
        m2: d.level,
        m3: (d.tags && d.tags[0]) || ''
      };
    };

    const fitRows = cookable.slice(0, 30).map(d => row(d));
    const nearRows = near.map(n => row(n.dish, n));

    // 全部：按菜系筛选 + 两列卡
    const FOREIGN = ['西餐', '日韩', '东南亚'];
    const allCuisines = {};
    D.DISHES.forEach(d => { (d.cuisine || []).forEach(c => { allCuisines[c] = (allCuisines[c] || 0) + 1; }); });

    const foreignN = D.DISHES.filter(d => (d.cuisine || []).some(c => FOREIGN.indexOf(c) >= 0)).length;
    const chipDefs = [{ key: 'all', label: '全部 ' + D.DISHES.length }];
    if (foreignN) chipDefs.push({ key: '@foreign', label: '🌍 外国菜 ' + foreignN });
    Object.keys(allCuisines)
      .sort((a, b) => allCuisines[b] - allCuisines[a])
      .forEach(c => chipDefs.push({ key: c, label: c + ' ' + allCuisines[c] }));

    const curCuisine = this.data.cuisine || 'all';
    const cuisineChips = chipDefs.map(c => ({
      key: c.key,
      label: c.label,
      cls: c.key === curCuisine ? 'chip on' : 'chip'
    }));

    // 餐次筛选：全部 / 早 / 午 / 晚
    const curMeal = this.data.meal || 'all';
    const mealDefs = [
      { key: 'all', label: '全部餐次' },
      { key: '早', label: '🌅 早餐' },
      { key: '午', label: '☀️ 午餐' },
      { key: '晚', label: '🌙 晚餐' }
    ];
    const mealChips = mealDefs.map(m => ({
      key: m.key,
      label: m.label,
      cls: m.key === curMeal ? 'chip on' : 'chip'
    }));

    let list = D.DISHES.slice();
    if (curCuisine === '@foreign') {
      list = list.filter(d => (d.cuisine || []).some(c => FOREIGN.indexOf(c) >= 0));
    } else if (curCuisine !== 'all') {
      list = list.filter(d => (d.cuisine || []).indexOf(curCuisine) >= 0);
    }
    if (curMeal !== 'all') {
      list = list.filter(d => (d.meals || []).indexOf(curMeal) >= 0);
    }
    const q = (this.data.q || '').trim();
    if (q) list = list.filter(d => d.name.indexOf(q) >= 0 || d.ingredients.some(i => i.name.indexOf(q) >= 0) || (d.tags || []).some(t => t.indexOf(q) >= 0));
    list = list.slice().sort((a, b) => {
      const pa = pinned.indexOf(a.id) >= 0 ? 1 : 0;
      const pb = pinned.indexOf(b.id) >= 0 ? 1 : 0;
      return pb - pa;
    });

    const parts = [];
    if (curCuisine !== 'all') parts.push(curCuisine === '@foreign' ? '外国菜' : curCuisine);
    if (curMeal !== 'all') parts.push(curMeal + '餐');
    const filterTitle = parts.length ? (parts.join(' · ') + ' · ' + list.length + ' 道') : '';

    const allRows = list.slice(0, 120).map(d => {
      const ok = E.ingredientState(d, foods).every(s => s.ok);
      const raw = S.getDishPhoto(d.id);
      const mine = validPhoto(raw) ? raw : '';
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        sub: (d.ingredients || []).map(i => i.name).join(' + '),
        ok: ok,
        pinCls: pinned.indexOf(d.id) >= 0 ? 'icobtn on' : 'icobtn',
        photo: mine || (P[d.id] ? ('/img/' + d.id + '.jpg') : ''),
        mineTag: mine ? '我的实拍' : '',
        myDish: !!d.custom || (d.tags || []).indexOf('网上菜谱') >= 0 || (d.tags || []).indexOf('自定义') >= 0,
        m1: d.minutes + ' 分钟',
        m2: d.level,
        cuisineText: (d.cuisine || []).join(' · ')
      };
    });

    // 相生相克
    let pairRows = [];
    try {
      pairRows = E.pairList(foods, false).slice(0, 30).map(p => ({
        a: p.a,
        b: p.b,
        why: p.why || '',
        tag: p.present ? '冰箱里有' : '建议搭配',
        cls: p.present ? 'ptag ok' : 'ptag'
      }));
    } catch (e) {}

    const cuisines = {};
    D.DISHES.forEach(d => { (d.cuisine || []).forEach(c => { cuisines[c] = 1; }); });

    this.setData({
      tabs: tabs,
      fitRows: fitRows,
      nearRows: nearRows,
      allRows: allRows,
      pairRows: pairRows,
      total: D.DISHES.length,
      cuisineCount: Object.keys(allCuisines).length,
      fitCount: cookable.length,
      cuisineChips: cuisineChips,
      mealChips: mealChips,
      filterTitle: filterTitle
    });
  },

  onMeal(e) {
    this.setData({ meal: e.currentTarget.dataset.key }, () => this.render());
  },

  onCuisine(e) {
    this.setData({ cuisine: e.currentTarget.dataset.key }, () => this.render());
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'video') {
      wx.navigateTo({ url: '/pages/video/index' });
      return;
    }
    this.setData({ tab: key }, () => this.render());
  },

  onSearch(e) {
    this.setData({ q: e.detail.value }, () => this.render());
  },

  onClear() {
    this.setData({ q: '' }, () => this.render());
  },

  onDish(e) {
    wx.navigateTo({ url: '/pages/dish/index?id=' + e.currentTarget.dataset.id });
  },

  onPin(e) {
    const id = e.currentTarget.dataset.id;
    S.togglePin(id);
    wx.showToast({ title: (S.state.pinned || []).indexOf(id) >= 0 ? '已置顶' : '已取消', icon: 'none' });
    this.render();
  },

  onCover(e) {
    const id = e.currentTarget.dataset.id;
    const self = this;
    privacy.ensure(() => {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        camera: 'back',
        success: (res) => {
          const tmp = res.tempFiles[0].tempFilePath;
          const commit = (p) => {
            if (!validPhoto(p)) {
              wx.showToast({ title: '照片保存失败，换一张试试', icon: 'none' });
              return;
            }
            S.setDishPhoto(id, p);
            wx.showToast({ title: '已设为封面', icon: 'none' });
            self.render();
          };
          try {
            wx.getFileSystemManager().saveFile({
              tempFilePath: tmp,
              success: (r) => commit(r.savedFilePath),
              fail: () => commit(tmp)
            });
          } catch (err) {
            commit(tmp);
          }
        },
        fail: () => {}
      });
    });
  },

  onNetSearch() {
    const q = (this.data.q || '').trim();
    if (!q) {
      wx.showToast({ title: '先输入菜名', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/netrecipe/index?q=' + encodeURIComponent(q) });
  },

  onAdd() {
    wx.showModal({
      title: '添加菜谱',
      editable: true,
      placeholderText: '输入想吃的菜，如：可乐鸡翅',
      success: (res) => {
        if (!res.confirm) return;
        const name = String(res.content || '').trim();
        if (!name) { wx.showToast({ title: '请输入菜名', icon: 'none' }); return; }
        // 先问要不要从网上找真做法，避免直接套模板
        wx.showActionSheet({
          itemList: ['从网上找真做法', '用模板快速生成'],
          success: (r) => {
            if (r.tapIndex === 0) {
              wx.navigateTo({ url: '/pages/netrecipe/index?q=' + encodeURIComponent(name) });
              return;
            }
            try {
              const draft = E.generateRecipe(name);
              S.addCustom(draft);
              E.attachCustom([draft]);
              wx.showToast({ title: '已加入：' + name, icon: 'none' });
              this.setData({ tab: 'all' }, () => this.render());
            } catch (e) {
              wx.showToast({ title: '生成失败', icon: 'none' });
            }
          }
        });
      }
    });
  }
});
