const D = globalThis.DD_DATA;
const E = globalThis.DD_ENGINE;
const S = globalThis.DD_STORE;
const WORDS = { g: '充足', y: '正常', p: '临期', b: '过期' };

Page({
  data: {
    filter: 'all',
    counts: { g: 0, y: 0, p: 0, b: 0 },
    foods: [],
    cats: [],
    urgent: [],
    name: '我',
    members: 0,
    total: 0
  },

  onShow() { this.refresh(); },

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

    list = list.map(f => {
      const t = E.tier(f);
      return {
        id: f.id,
        name: f.name,
        emoji: f.emoji,
        qty: E.fmtQty(f.qty) + ' ' + f.unit,
        tier: t,
        tierWord: WORDS[t],
        day: E.dayText(f)
      };
    });

    // 分类 chips
    const catSet = [];
    st.foods.forEach(f => { if (f.cat && catSet.indexOf(f.cat) < 0) catSet.push(f.cat); });
    const cats = [{ key: 'all', label: '全部', n: st.foods.length }]
      .concat([{ key: 'p', label: '临期', n: c.p }, { key: 'b', label: '过期', n: c.b }])
      .concat(catSet.map(k => ({ key: k, label: k, n: st.foods.filter(f => f.cat === k).length })));

    this.setData({
      counts: c,
      foods: list,
      cats: cats,
      total: st.foods.length,
      urgent: E.urgentList(st.foods).slice(0, 3).map(f => f.name),
      name: st.family.name || '我',
      members: (st.family.members || []).length
    });
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => this.refresh());
  },

  onFood(e) {
    const id = e.currentTarget.dataset.id;
    const f = S.get(id);
    if (!f) return;
    wx.showActionSheet({
      itemList: ['吃掉 1 份', '丢掉', '取消'],
      success: (res) => {
        if (res.tapIndex === 0) {
          S.consume(id, 1);
          wx.showToast({ title: '已吃掉一份', icon: 'none' });
        } else if (res.tapIndex === 1) {
          S.trash(id);
          wx.showToast({ title: '已丢弃', icon: 'none' });
        } else return;
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
        // 演示版：用预设场景模拟识别结果
        const scenes = D.PHOTO_SCENES || [];
        const scene = scenes[Math.floor(Math.random() * scenes.length)];
        if (!scene) return;
        scene.items.forEach(it => S.add(it.name, it.qty, it.shelf));
        wx.showToast({ title: '识别到 ' + scene.items.length + ' 件，已入库', icon: 'none' });
        this.refresh();
      },
      fail: () => {}
    });
  }
});
