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
    speaking: false
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

  /* ---------- 语音朗读（微信同声传译插件） ---------- */
  speak(text) {
    const self = this;
    if (!text) return;
    let plugin = null;
    try {
      plugin = requirePlugin('WechatSI');
    } catch (e) {
      plugin = null;
    }
    if (!plugin) {
      wx.showModal({
        title: '语音暂不可用',
        content: '小程序语音需要在小程序后台关联「微信同声传译」插件（真实 AppID）。\n\n网页版可以直接用系统语音朗读这道菜。',
        showCancel: false
      });
      return;
    }
    wx.showLoading({ title: '合成中', mask: false });
    plugin.textToSpeech({
      lang: 'zh_CN',
      tts: true,
      content: text,
      success: (res) => {
        wx.hideLoading();
        if (!res || !res.filename) {
          wx.showToast({ title: '合成失败', icon: 'none' });
          return;
        }
        if (!self.audio) {
          self.audio = wx.createInnerAudioContext();
          self.audio.onEnded(() => self.setData({ speaking: false }));
          self.audio.onError(() => self.setData({ speaking: false }));
        }
        self.audio.src = res.filename;
        self.audio.play();
        self.setData({ speaking: true });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '语音合成失败', icon: 'none' });
      }
    });
  },

  onSpeakStep(e) {
    const i = parseInt(e.currentTarget.dataset.i, 10);
    const s = this.data.steps[i];
    if (s) this.speak(s.text);
  },

  onSpeakAll() {
    const parts = [];
    (this.data.prep || []).forEach(p => parts.push(p));
    (this.data.steps || []).forEach(s => parts.push('第' + s.no + '步，' + s.heat + '。' + s.text));
    this.speak(parts.join('。'));
  },

  onStop() {
    if (this.audio) {
      try { this.audio.stop(); } catch (e) {}
    }
    this.setData({ speaking: false });
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
