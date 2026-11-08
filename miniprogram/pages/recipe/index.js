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
      { key: 'shared', label: '大家分享' },
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
      // 视频库：列出有共享视频的菜，点进去直接看
      wx.navigateTo({ url: '/pages/videolib/index' });
      return;
    }
    this.setData({ tab: key }, () => {
      this.render();
      if (key === 'shared') this.loadShared();
    });
  },

  /* 大家分享：从云端拉共享菜谱 */
  loadShared() {
    if (!wx.cloud) {
      this.setData({ sharedErr: '未配置云开发' });
      return;
    }
    const self = this;
    this.setData({ sharedLoading: true, sharedErr: '' });
    wx.cloud.callFunction({
      name: 'sharedDishes',
      data: { action: 'list' },
      success: (res) => {
        const d = (res && res.result) || {};
        if (!d.ok) {
          const raw = d.error || '读取失败';
          self.setData({
            sharedLoading: false,
            sharedErr: raw === '未知 action' ? '共享菜谱服务未部署，请部署 cloudfunctions/sharedDishes' : raw,
            sharedRows: []
          });
          return;
        }
        const rows = (d.items || []).map(x => ({
          id: x.dishId,
          name: x.name,
          emoji: x.emoji || '🍽',
          meta: (x.cuisine || []).join(' / ') || '家常',
          tags: (x.tags || []).slice(0, 2).join(' · '),
          nick: x.nick,
          steps: (x.steps || []).length,
          raw: x
        }));
        self.setData({ sharedLoading: false, sharedRows: rows, sharedErr: '' });
      },
      fail: (e) => self.setData({ sharedLoading: false, sharedErr: '调用失败：' + ((e && e.errMsg) || '') })
    });
  },

  /* 打开共享菜谱：先注入菜谱库，再进详情 */
  onSharedDish(e) {
    const i = Number(e.currentTarget.dataset.i);
    const row = (this.data.sharedRows || [])[i];
    if (!row || !row.raw) return;
    const x = row.raw;
    const dish = {
      id: x.dishId,
      name: x.name,
      emoji: x.emoji,
      cuisine: x.cuisine,
      tags: (x.tags || []).concat(['大家分享']),
      meals: ['午', '晚'],
      minutes: x.minutes,
      level: x.level,
      ingredients: x.ingredients,
      seasonings: x.seasonings,
      prep: x.prep,
      steps: x.steps,
      tips: x.tips,
      nutrition: x.nutrition,
      pair: x.pair,
      custom: true
    };
    if (!D.DISHES.some(y => y.id === dish.id)) D.DISHES.push(dish);
    wx.navigateTo({ url: '/pages/dish/index?id=' + dish.id });
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
          const dish = D.DISHES.filter(x => x.id === id)[0] || {};

          // 先压缩再落盘，避免相册原图撑爆本地存储
          const finish = (compressed) => {
            const commit = (p) => {
              if (!validPhoto(p)) {
                wx.showToast({ title: '照片保存失败，换一张试试', icon: 'none' });
                return;
              }
              S.setDishPhoto(id, p);
              wx.showToast({ title: '已设为封面', icon: 'none' });
              self.render();
              self.askPublishCover(id, dish.name || '', compressed);
            };
            try {
              wx.getFileSystemManager().saveFile({
                tempFilePath: compressed,
                success: (r) => commit(r.savedFilePath),
                fail: () => commit(compressed)
              });
            } catch (err) {
              commit(compressed);
            }
          };

          wx.compressImage({
            src: tmp,
            quality: 72,
            compressedWidth: 900,
            success: (r) => finish(r.tempFilePath || tmp),
            fail: () => finish(tmp)
          });
        },
        fail: () => {}
      });
    });
  },

  /* 拍完封面，问要不要发到公开实拍图库 */
  askPublishCover(dishId, dishName, localPath) {
    if (!wx.cloud || !localPath) return;
    wx.showModal({
      title: '分享到实拍图库',
      content: '把这你张成品照公开给其他人看？大家能在这道菜下面看到你的实拍。',
      confirmText: '公开',
      cancelText: '仅自己看',
      success: (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '上传中…', mask: true });
        const ext = (localPath.match(/\.(\w+)$/) || [, 'jpg'])[1];
        wx.cloud.uploadFile({
          cloudPath: 'dish-photos/' + dishId + '-' + Date.now() + '.' + ext,
          filePath: localPath,
          success: (up) => {
            wx.cloud.callFunction({
              name: 'gallery',
              data: {
                action: 'publish',
                dishId: dishId,
                dishName: dishName,
                fileID: up.fileID,
                nick: (S.state.family && S.state.family.name) || '冰箱用户'
              },
              success: (res) => {
                wx.hideLoading();
                const d = (res && res.result) || {};
                if (!d.ok) { wx.showToast({ title: d.error || '发布失败', icon: 'none' }); return; }
                wx.showToast({ title: d.status === 'ok' ? '已公开' : '已提交，待审核', icon: 'none' });
              },
              fail: () => { wx.hideLoading(); wx.showToast({ title: '发布失败', icon: 'none' }); }
            });
          },
          fail: () => { wx.hideLoading(); wx.showToast({ title: '上传失败', icon: 'none' }); }
        });
      }
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
