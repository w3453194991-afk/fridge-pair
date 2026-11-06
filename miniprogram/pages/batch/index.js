const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;

Page({
  data: {
    tab: 'foods',        // foods | cart
    rows: [],
    checked: {},         // id -> true
    checkedCount: 0,
    total: 0,
    tabFoodsN: 0,
    tabFoods: 'tab on',
    tabCart: 'tab'
  },

  onShow() {
    this.render();
  },

  render() {
    const st = S.state || {};
    const tab = this.data.tab;
    const checked = this.data.checked || {};
    const rows = [];

    if (tab === 'foods') {
      (st.foods || []).forEach(f => {
        const t = E.tier(f);
        rows.push({
          key: f.id,
          name: f.name,
          emoji: f.emoji || E.foodMeta(f.name).emoji,
          sub: E.fmtQty(f.qty) + ' ' + (f.unit || ''),
          right: E.dayText(f),
          cls: 'row ' + t,
          pillCls: 'pill ' + t,
          pillText: { g: '充足', y: '正常', p: '临期', b: '过期' }[t] || '',
          on: !!checked[f.id]
        });
      });
    } else {
      (st.cart || []).forEach((c, i) => {
        const meta = E.foodMeta(c.name);
        rows.push({
          key: 'c' + i,
          name: c.name,
          emoji: c.emoji || meta.emoji,
          sub: E.fmtQty(c.qty) + ' ' + (c.unit || meta.unit),
          right: '约 ¥' + ((c.qty || 1) * (meta.price || 0)).toFixed(1),
          cls: 'row',
          pillCls: 'pill',
          pillText: '',
          on: !!checked['c' + i]
        });
      });
    }

    const n = rows.filter(r => r.on).length;
    this.setData({
      rows: rows,
      total: rows.length,
      checkedCount: n,
      tabFoodsN: (st.foods || []).length,
      tabFoods: tab === 'foods' ? 'tab on' : 'tab',
      tabCart: tab === 'cart' ? 'tab on' : 'tab'
    });
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab, checked: {}, checkedCount: 0 }, () => this.render());
  },

  onToggle(e) {
    const key = e.currentTarget.dataset.key;
    const checked = Object.assign({}, this.data.checked);
    if (checked[key]) delete checked[key];
    else checked[key] = true;
    this.setData({ checked: checked }, () => this.render());
  },

  onAll() {
    const checked = {};
    this.data.rows.forEach(r => { checked[r.key] = true; });
    this.setData({ checked: checked }, () => this.render());
  },

  onClearSel() {
    this.setData({ checked: {} }, () => this.render());
  },

  /* 批量丢掉（仅冰箱食材） */
  onTrash() {
    const ids = Object.keys(this.data.checked || {});
    if (!ids.length) {
      wx.showToast({ title: '先勾选食材', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '批量丢掉',
      content: '将丢弃 ' + ids.length + ' 种食材，并记入浪费统计。',
      confirmText: '丢掉',
      confirmColor: '#B91C1C',
      success: (r) => {
        if (!r.confirm) return;
        try {
          if (S.trashMany) S.trashMany(ids);
          else ids.forEach(id => S.trash(id));
          S.save();
        } catch (e) {
          wx.showModal({ title: '操作失败', content: String((e && e.message) || e), showCancel: false });
          return;
        }
        wx.showToast({ title: '已丢掉 ' + ids.length + ' 种', icon: 'none' });
        this.setData({ checked: {} }, () => this.render());
      }
    });
  },

  /* 批量吃掉一份（仅冰箱食材） */
  onConsume() {
    const ids = Object.keys(this.data.checked || {});
    if (!ids.length) {
      wx.showToast({ title: '先勾选食材', icon: 'none' });
      return;
    }
    try {
      ids.forEach(id => {
        const f = S.get(id);
        if (f) S.consume(id, f.qty > 1 ? 0.5 : 1);
      });
      S.save();
    } catch (e) {
      wx.showModal({ title: '操作失败', content: String((e && e.message) || e), showCancel: false });
      return;
    }
    wx.showToast({ title: '已处理 ' + ids.length + ' 种', icon: 'none' });
    this.setData({ checked: {} }, () => this.render());
  },

  /* 批量购入（仅采购清单） */
  onBuy() {
    const keys = Object.keys(this.data.checked || {});
    if (!keys.length) {
      wx.showToast({ title: '先勾选要买的', icon: 'none' });
      return;
    }
    const st = S.state;
    const pick = keys.map(k => Number(String(k).replace('c', ''))).sort((a, b) => b - a);
    let n = 0;
    try {
      pick.forEach(i => {
        const c = st.cart[i];
        if (!c) return;
        const meta = E.foodMeta(c.name);
        S.add(c.name, Math.max(c.qty, 1), Math.max(1, meta.shelf || 7), meta.storage);
        st.cart.splice(i, 1);
        n++;
      });
      S.save();
    } catch (e) {
      wx.showModal({ title: '入库失败', content: String((e && e.message) || e), showCancel: false });
      return;
    }
    wx.showToast({ title: '已入库 ' + n + ' 件', icon: 'success' });
    this.setData({ checked: {} }, () => this.render());
  },

  onRemoveCart() {
    const keys = Object.keys(this.data.checked || {});
    if (!keys.length) {
      wx.showToast({ title: '先勾选', icon: 'none' });
      return;
    }
    const st = S.state;
    const pick = keys.map(k => Number(String(k).replace('c', ''))).sort((a, b) => b - a);
    pick.forEach(i => st.cart.splice(i, 1));
    S.save();
    wx.showToast({ title: '已移出清单', icon: 'none' });
    this.setData({ checked: {} }, () => this.render());
  }
});
