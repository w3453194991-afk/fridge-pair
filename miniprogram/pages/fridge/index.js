const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
const WORDS = { g: '充足', y: '正常', p: '临期', b: '过期' };
const COLORS = { g: '#35C77E', y: '#F5B301', p: '#9B6BF5', b: '#9AA3AF' };

Page({
  data: {
    filter: 'all',
    counts: { g: 0, y: 0, p: 0, b: 0 },
    foods: [],
    cats: [],
    urgentText: '',
    hasUrgent: false,
    freshText: '',
    freshCls: 'fresh ok',
    name: '我',
    members: 0,
    total: 0,
    dateText: '',
    aiA: '', aiB: '', aiWhy: '', aiDishId: '', hasAI: false,
    meals: [],
    hasMenu: false,
    err: ''
  },

  onLoad() {
    if (!D || !E || !S) {
      this.setData({ err: '核心未加载' });
      return;
    }
    this.ready = false;
  },

  onReady() {
    this.ready = true;
    this.refresh();
  },

  onShow() {
    if (this.ready) this.refresh();
  },

  refresh() {
    try {
      const st = S.state;
      const c = E.counts(st.foods);
      const total = c.g + c.y + c.p + c.b;
      const filter = this.data.filter;

      let list = st.foods.slice();
      if (filter === 'p') list = list.filter(f => E.tier(f) === 'p');
      else if (filter === 'b') list = list.filter(f => E.tier(f) === 'b');
      else if (filter !== 'all') list = list.filter(f => f.cat === filter);

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
      const cats = [{ key: 'all', label: '全部 ' + st.foods.length }]
        .concat([{ key: 'p', label: '临期 ' + c.p }, { key: 'b', label: '过期 ' + c.b }])
        .concat(catSet.map(k => ({ key: k, label: k + ' ' + st.foods.filter(f => f.cat === k).length })));
      cats.forEach(x => { x.cls = x.key === filter ? 'chip on' : 'chip'; });

      const urgent = E.urgentList(st.foods).slice(0, 3);
      let urgentText = '';
      if (urgent.length) urgentText = '⚡ ' + urgent.length + ' 种临期：' + urgent.map(f => f.name).join('、') + '，优先吃掉';

      // AI 搭配
      let ai = { a: '', b: '', why: '', id: '', has: false };
      try {
        const sug = E.topSuggestion(st.foods, this.data.aiIdx || 0);
        if (sug) {
          ai = {
            a: sug.a, b: sug.b,
            why: sug.dish ? (sug.title + ' · ' + (sug.dish.ingredients || []).map(i => i.name).join(' + ')) : (sug.desc || ''),
            id: sug.dish ? sug.dish.id : '',
            has: true
          };
        }
      } catch (e) {}

      // 今天的菜单
      const week = st.week || [];
      let meals = [];
      if (week.length) {
        const day = week[0];
        ['早', '午', '晚'].forEach(slot => {
          const m = day.meals && day.meals[slot];
          if (!m || !m.ids || !m.ids.length) return;
          const names = m.ids.map(id => {
            const x = D.DISHES.filter(y => y.id === id)[0];
            return x ? x.emoji + ' ' + x.name : '';
          }).filter(Boolean).join('、');
          meals.push({ slot: slot, names: names });
        });
      }

      // 日期
      const now = new Date();
      const dateText = (now.getMonth() + 1) + '月' + now.getDate() + '日';

      this.setData({
        counts: c,
        total: total,
        foods: foods,
        cats: cats,
        hasUrgent: urgent.length > 0,
        urgentText: urgentText,
        freshText: c.p ? ('⚡ ' + c.p + ' 种食材临期，请优先食用') : '✓ 食材新鲜，营养满分',
        freshCls: c.p ? 'fresh warn' : 'fresh ok',
        name: st.family.name || '我',
        members: (st.family.members || []).length,
        dateText: dateText,
        aiA: ai.a, aiB: ai.b, aiWhy: ai.why, aiDishId: ai.id, hasAI: ai.has,
        meals: meals,
        hasMenu: meals.length > 0
      }, () => this.drawRing(c, total));
    } catch (e) {
      this.setData({ err: String((e && e.message) || e) });
    }
  },

  drawRing(c, total) {
    if (!this.ready) return;
    this.createSelectorQuery()
      .select('#ring')
      .fields({ node: true, size: true })
      .exec(res => {
        const item = res && res[0];
        if (!item || !item.node) return;
        const canvas = item.node;
        const ctx = canvas.getContext('2d');
        let dpr = 2;
        try { dpr = wx.getWindowInfo().pixelRatio || 2; } catch (e) {}
        const w = item.width, h = item.height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        const cx = w / 2, cy = h / 2;
        const r = Math.min(w, h) / 2 - 8;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#F1ECE4';
        ctx.stroke();

        const sum = total || (c.g + c.y + c.p + c.b);
        if (!sum) return;
        let start = -Math.PI / 2;
        [['g'], ['y'], ['p'], ['b']].forEach(k => {
          const n = c[k[0]] || 0;
          if (!n) return;
          const ang = (n / sum) * Math.PI * 2;
          const gap = ang > 0.12 ? 0.04 : 0;
          ctx.beginPath();
          ctx.arc(cx, cy, r, start + gap, start + ang - gap);
          ctx.strokeStyle = COLORS[k[0]];
          ctx.stroke();
          start += ang;
        });
      });
  },

  onShuffleAI() {
    this.setData({ aiIdx: (this.data.aiIdx || 0) + 1 }, () => this.refresh());
  },

  onAIDish() {
    if (this.data.aiDishId) {
      wx.navigateTo({ url: '/pages/dish/index?id=' + this.data.aiDishId });
    } else {
      wx.switchTab({ url: '/pages/recipe/index' });
    }
  },

  onGen() {
    S.state.week = E.planWeek(S.state);
    S.save();
    this.refresh();
    wx.showToast({ title: '已排好今天的三餐', icon: 'none' });
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => this.refresh());
  },

  onFood(e) {
    const id = e.currentTarget.dataset.id;
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
