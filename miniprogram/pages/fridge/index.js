const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
const WORDS = { g: '充足', y: '正常', p: '临期', b: '过期' };

Page({
  data: {
    filter: 'all',
    counts: { g: 0, y: 0, p: 0, b: 0 },
    foods: [],
    cats: [],
    urgentText: '',
    hasUrgent: false,
    name: '我',
    members: 0,
    total: 0,
    err: '',
    dbgCore: ''
  },

  onLoad() {
    const ok = [!!D, !!E, !!S].join('/');
    console.log('[mp] 核心加载 data/engine/store =', ok, '| 食材', D ? D.FOOD_DB.length : 0);
    this.setData({ dbgCore: ok });
  },

  onShow() {
    try {
      if (!D || !E || !S) throw new Error('核心未加载');
      this.refresh();
    } catch (e) {
      this.setData({ err: String((e && e.message) || e) });
    }
  },

  refresh() {
    const st = S.state;
    const c = E.counts(st.foods);
    const filter = this.data.filter;

    let list = st.foods.slice();
    if (filter === 'p') list = list.filter(f => E.tier(f) === 'p');
    else if (filter === 'b') list = list.filter(f => E.tier(f) === 'b');
    else if (filter.indexOf('z:') === 0) {
      const z = filter.slice(2);
      list = list.filter(f => (f.storage || '冷藏') === z);
    } else if (filter !== 'all') {
      list = list.filter(f => f.cat === filter);
    }

    const foods = list.map(f => {
      const t = E.tier(f);
      return {
        id: f.id,
        name: f.name,
        emoji: f.emoji,
        qty: E.fmtQty(f.qty) + ' ' + f.unit,
        cls: 'food ' + t,
        pillCls: 'pill ' + t,
        dayCls: t,
        tierWord: WORDS[t] || '',
        day: E.dayText(f)
      };
    });

    const catSet = [];
    st.foods.forEach(f => { if (f.cat && catSet.indexOf(f.cat) < 0) catSet.push(f.cat); });

    const cats = [
      { key: 'all', label: '全部 ' + st.foods.length, cls: 'chip' },
      { key: 'p', label: '临期 ' + c.p, cls: 'chip' },
      { key: 'b', label: '过期 ' + c.b, cls: 'chip' }
    ].concat(catSet.map(k => ({
      key: k,
      label: k + ' ' + st.foods.filter(f => f.cat === k).length,
      cls: 'chip'
    })));

    cats.forEach(x => {
      if (x.key === filter) x.cls = 'chip on';
    });

    const urgent = E.urgentList(st.foods).slice(0, 3);
    let urgentText = '';
    if (urgent.length) {
      urgentText = '⚡ ' + urgent.length + ' 种临期：' + urgent.map(f => f.name).join('、') + '，优先吃掉';
    }

    this.setData({
      counts: c,
      foods: foods,
      cats: cats,
      total: st.foods.length,
      hasUrgent: urgent.length > 0,
      urgentText: urgentText,
      name: st.family.name || '我',
      members: (st.family.members || []).length
    });
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => this.refresh());
  },

  onFood(e) {
    const id = e.currentTarget.dataset.id;
    S.get(id);
    wx.showActionSheet({
      itemList: ['吃掉 1 份', '丢掉'],
      success: (res) => {
        if (res.tapIndex === 0) S.consume(id, 1);
        else S.trash(id);
        wx.showToast({ title: res.tapIndex === 0 ? '已吃掉一份' : '已丢弃', icon: 'none' });
        this.refresh();
      }
    });
  },

  onUrgent() {
    this.setData({ filter: 'p' }, () => this.refresh());
  },

  onShoot() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: () => {
        const scenes = D.PHOTO_SCENES || [];
        const scene = scenes[Math.floor(Math.random() * scenes.length)];
        if (!scene) return;
        scene.items.forEach(it => S.add(it.name, it.qty, it.shelf));
        wx.showToast({ title: '识别到 ' + scene.items.length + ' 件', icon: 'none' });
        this.refresh();
      },
      fail: () => {}
    });
  }
});
