const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
let P = {};
try { P = require('../../lib/photos.js') || {}; } catch (e) { P = {}; }

Page({
  data: {
    dish: null,
    states: [],
    prep: [],
    steps: [],
    can: false,
    /* 朗读模式 */
    readMode: false,
    readIdx: 0,
    readText: '',
    readNo: '',
    readTotal: 0,
    playing: false,
    speed: 4
  },

  onLoad(q) {
    const d = D.DISHES.filter(x => x.id === q.id)[0];
    if (!d) { wx.navigateBack(); return; }
    const st = S.state;

    const states = E.ingredientState(d, st.foods).map(s => ({
      name: s.name,
      amount: E.fmtQty(s.qty) + ' ' + (s.unit || ''),
      ok: s.ok,
      pillCls: s.ok ? 'pill g' : 'pill b',
      pillText: s.ok ? '库存够' : (s.expired ? '已过期' : '缺料')
    }));

    this.setData({
      dish: {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        minutes: d.minutes,
        level: d.level,
        cuisine: (d.cuisine || []).join(' / '),
        tags: (d.tags || []).join(' · '),
        seasonings: d.seasonings || [],
        photo: P[d.id] ? ('/img/' + d.id + '.jpg') : ''
      },
      steps: (d.steps || []).map((s, i) => ({
        no: i + 1,
        heat: s.heat,
        text: s.text
      })),
      prep: d.prep || [],
      states: states,
      can: states.every(s => s.ok)
    });
  },

  /* ---------- 朗读模式（不依赖插件） ---------- */
  buildLines() {
    const lines = [];
    (this.data.prep || []).forEach((p, i) => {
      lines.push({ tag: '备料 ' + (i + 1), text: p });
    });
    (this.data.steps || []).forEach(s => {
      lines.push({ tag: '第 ' + s.no + ' 步' + (s.heat ? ' · ' + s.heat : ''), text: s.text });
    });
    return lines;
  },

  openRead(startAt) {
    const lines = this.buildLines();
    if (!lines.length) return;
    this.lines = lines;
    this.gotoLine(startAt || 0, false);
    this.setData({ readMode: true });
  },

  gotoLine(i, play) {
    const lines = this.lines || [];
    if (!lines.length) return;
    const idx = Math.max(0, Math.min(lines.length - 1, i));
    const l = lines[idx];
    this.setData({
      readIdx: idx,
      readNo: l.tag,
      readText: l.text,
      readTotal: lines.length,
      playing: !!play
    });
    try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
    this.tick();
  },

  tick() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.data.playing) return;
    const ms = (this.data.speed || 4) * 1000;
    this.timer = setTimeout(() => {
      const next = this.data.readIdx + 1;
      if (next >= (this.lines || []).length) {
        this.setData({ playing: false });
        try { wx.vibrateShort({ type: 'heavy' }); } catch (e) {}
        return;
      }
      this.gotoLine(next, true);
    }, ms);
  },

  onRead() {
    this.openRead(0);
  },

  onReadStep(e) {
    const i = parseInt(e.currentTarget.dataset.i, 10);
    this.openRead(i);
  },

  onReadPrev() {
    this.gotoLine(this.data.readIdx - 1, this.data.playing);
  },

  onReadNext() {
    this.gotoLine(this.data.readIdx + 1, this.data.playing);
  },

  onReadPlay() {
    if (this.data.playing) {
      this.setData({ playing: false });
      if (this.timer) clearTimeout(this.timer);
      return;
    }
    this.setData({ playing: true }, () => this.tick());
  },

  onSpeed() {
    const order = [3, 5, 8];
    const cur = order.indexOf(this.data.speed);
    this.setData({ speed: order[(cur + 1) % order.length] }, () => this.tick());
  },

  onReadClose() {
    if (this.timer) clearTimeout(this.timer);
    this.setData({ readMode: false, playing: false });
  },

  /* ---------- 做菜 / 视频 ---------- */
  onCook() {
    try {
      const d = D.DISHES.filter(x => x.id === this.data.dish.id)[0];
      if (!d) return;
      const states = E.ingredientState(d, S.state);
      if (!states.every(s => s.ok)) {
        const lack = states.filter(s => !s.ok).map(s => s.name).join('、');
        wx.showToast({ title: '还差：' + lack, icon: 'none' });
        return;
      }
      const res = E.cook(d, S.state);
      S.save();
      const lines = res.used.map(u => u.name + ' -' + E.fmtQty(u.qty) + u.unit + '（剩 ' + E.fmtQty(u.left) + '）').join('\n');
      wx.showModal({
        title: '做完啦，库存已更新',
        content: lines,
        showCancel: false,
        confirmText: '好的',
        success: () => wx.navigateBack()
      });
    } catch (err) {
      wx.showModal({ title: '操作失败', content: String((err && err.message) || err), showCancel: false });
    }
  },

  onVideo() {
    try {
      const d = this.data.dish;
      if (!d) return;
      const vids = (D.VIDEOS || {})[d.id];
      if (vids && vids.length) {
        wx.navigateTo({ url: '/pages/player/index?bvid=' + vids[0].bvid });
      } else {
        wx.navigateTo({ url: '/pages/video/index?q=' + encodeURIComponent(d.name) });
      }
    } catch (err) {
      wx.showToast({ title: '打开失败', icon: 'none' });
    }
  }
});
