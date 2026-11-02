/* ============================================================
   冰箱对对碰 · 交互层
   ============================================================ */
(function (w, d) {
  'use strict';
  const D = w.DD_DATA, E = w.DD_ENGINE, S = w.DD_STORE, U = w.DD_UI;

  w.DD_VIEW = {
    filter: 'all', recTab: 'fit', q: '', vq: '', sugIdx: 0,
    party: { dateKey: 'fri', men: 2, women: 2, kids: 1, cuisine: '家常', wish: '', taste: '', budget: 0 },
    login: { phone: '', code: '', sent: false },
    nearby: { city: '杭州', lat: 30.2741, lng: 120.1551, src: '默认城市', status: 'idle', shops: [] },
    showMap: false,
    onb: null
  };

  function defaultOnb() {
    return {
      step: 1,
      name: '我',
      members: [
        { name: '我', role: '成人', gender: '女', age: 30 },
        { name: '孩子', role: '幼儿', gender: '男', age: 4 }
      ],
      taboos: ''
    };
  }

  const APP = { view: { name: 'fridge' }, stack: [] };
  const appEl = d.getElementById('app');
  const pageEl = d.getElementById('page');
  const titleEl = d.getElementById('navTitle');
  const backEl = d.getElementById('navBack');
  const tabbar = d.getElementById('tabbar');
  const modalEl = d.getElementById('modal');
  const toastEl = d.getElementById('toast');

  /* ---------------- 基础 ---------------- */
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function go(view, push) {
    if (push !== false) APP.stack.push(APP.view);
    APP.view = view;
    renderAll(true);
  }
  function tabTo(name) {
    APP.stack = [];
    APP.view = { name: name };
    renderAll(true);
  }
  function back() {
    APP.view = APP.stack.pop() || { name: 'fridge' };
    renderAll(true);
  }

  function renderAll(scrollTop) {
    const r = U.render(APP.view);
    pageEl.innerHTML = r.html;
    titleEl.innerHTML = r.title === '冰箱对对碰'
      ? '<span class="nav-logo">🧊</span>冰箱对对碰'
      : U.esc(r.title);
    backEl.hidden = !r.back;
    appEl.classList.toggle('hide-nav', r.hideNav === true);
    appEl.classList.toggle('hide-tab', r.hideTab === true);
    Array.from(tabbar.querySelectorAll('.tab[data-nav]')).forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-nav') === r.tab);
    });
    if (scrollTop) pageEl.scrollTop = 0;
    try {
      history.replaceState(null, '', '#' + APP.view.name + (APP.view.id ? '/' + APP.view.id : ''));
    } catch (err) { /* file:// 下忽略 */ }
    S.save();
  }

  function viewFromHash() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    if (!h) return { name: 'fridge' };
    const parts = h.split('/');
    const n = parts[0], id = parts[1];
    if (['fridge', 'recipe', 'plan', 'me', 'week', 'party'].indexOf(n) >= 0) return { name: n };
    if ((n === 'dish' || n === 'food') && id) return { name: n, id: id };
    return { name: 'fridge' };
  }

  /* ---------------- 时钟 ---------------- */
  function tick() {
    const t = new Date();
    d.getElementById('clock').textContent =
      String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  }

  /* ---------------- 弹层 ---------------- */
  function closeModal() {
    modalEl.hidden = true;
    modalEl.innerHTML = '';
    CAM = null;
  }
  function openModal(html) {
    modalEl.hidden = false;
    modalEl.innerHTML = '<div class="mask" data-action="closeModal"></div><div class="sheet">' + html + '</div>';
  }

  /* ============================================================
     点击分发
     ============================================================ */
  d.addEventListener('click', function (e) {
    const t = e.target.closest('[data-nav],[data-food],[data-dish],[data-filter],[data-tabrec],[data-action],[data-cook],[data-week],[data-people],[data-cam-step],[data-party-date],[data-party-cuisine],[data-hot],[data-play],[data-ext],[data-count],[data-report],[data-timer],[data-speak],[data-speakall],[data-chip],[data-pin],[data-system],[data-city]');
    if (!t) return;

    if (t.hasAttribute('data-pin')) {
      const id = t.getAttribute('data-pin');
      const on = S.togglePin(id);
      renderAll(false);
      toast(on ? '已置顶，排在最前面了' : '已取消置顶');
      return;
    }

    if (t.hasAttribute('data-ext')) {
      openExternal(t.getAttribute('data-ext'));
      return;
    }
    if (t.hasAttribute('data-report')) { go({ name: 'report' }); return; }
    if (t.hasAttribute('data-timer')) { startTimer(t); return; }
    if (t.hasAttribute('data-speak')) { speak(t.getAttribute('data-speak')); return; }
    if (t.hasAttribute('data-speakall')) {
      const dd = D.DISHES.filter(x => x.id === t.getAttribute('data-speakall'))[0];
      if (dd) speak(dd.name + '。' + dd.steps.map((s, i) => '第' + (i + 1) + '步，' + s.text).join(' '));
      return;
    }
    if (t.hasAttribute('data-chip')) { runChip(parseInt(t.getAttribute('data-chip'), 10)); return; }
    if (t.hasAttribute('data-count')) {
      const n = Math.max(1, Math.min(8, parseInt(t.getAttribute('data-count'), 10) || 1));
      const ob = w.DD_VIEW.onb;
      while (ob.members.length < n) ob.members.push({ name: '', role: '成人', gender: '女', age: 30 });
      while (ob.members.length > n) ob.members.pop();
      renderAll(false);
      return;
    }
    if (t.hasAttribute('data-nav')) { tabTo(t.getAttribute('data-nav')); return; }
    if (t.hasAttribute('data-system')) {
      S.state.family.system = t.getAttribute('data-system');
      S.state.week = null;
      S.save();
      renderAll(false);
      const sys = D.SYSTEM_MAP[t.getAttribute('data-system')];
      toast('已切到' + (sys ? sys.name : '') + '餐饮体系');
      return;
    }
    if (t.hasAttribute('data-city')) {
      const c = t.getAttribute('data-city');
      const preset = CITY_COORDS[c];
      const N = w.DD_VIEW.nearby;
      N.city = c;
      if (preset) { N.lat = preset[0]; N.lng = preset[1]; N.src = '手动选择城市'; N.status = 'idle'; N.shops = []; }
      renderAll(false);
      return;
    }
    if (t.hasAttribute('data-food')) { go({ name: 'food', id: t.getAttribute('data-food') }); return; }
    if (t.hasAttribute('data-dish')) { closeModal(); go({ name: 'dish', id: t.getAttribute('data-dish') }); return; }
    if (t.hasAttribute('data-week')) { go({ name: 'week' }); return; }
    if (t.hasAttribute('data-play')) { openVideo(t.getAttribute('data-play'), t.getAttribute('data-title')); return; }

    if (t.hasAttribute('data-party-date')) {
      w.DD_VIEW.party.dateKey = t.getAttribute('data-party-date');
      renderAll(false);
      return;
    }
    if (t.hasAttribute('data-party-cuisine')) {
      w.DD_VIEW.party.cuisine = t.getAttribute('data-party-cuisine');
      renderAll(false);
      return;
    }
    if (t.hasAttribute('data-hot')) {
      w.DD_VIEW.q = t.getAttribute('data-hot');
      renderAll(false);
      return;
    }

    if (t.hasAttribute('data-filter')) {
      w.DD_VIEW.filter = t.getAttribute('data-filter');
      renderAll(false);
      return;
    }
    if (t.hasAttribute('data-tabrec')) {
      w.DD_VIEW.recTab = t.getAttribute('data-tabrec');
      renderAll(false);
      return;
    }
    if (t.hasAttribute('data-people')) {
      w.DD_VIEW.people = parseInt(t.getAttribute('data-people'), 10);
      renderAll(false);
      return;
    }
    if (t.hasAttribute('data-cook')) { doCook(t.getAttribute('data-cook')); return; }
    if (t.hasAttribute('data-cam-step')) {
      camStep(t.getAttribute('data-cam-step'), t.getAttribute('data-i'));
      return;
    }

    const act = t.getAttribute('data-action');
    if (!act) return;

    switch (act) {
      case 'closeModal': closeModal(); break;

      case 'shoot': openCamera('add'); break;
      case 'repic': openCamera('update', t.getAttribute('data-id')); break;

      case 'swap':
        w.DD_VIEW.sugIdx = (w.DD_VIEW.sugIdx || 0) + 1;
        renderAll(false);
        break;

      case 'genMenu': openUrgentMenu(); break;

      case 'eat': openEat(t.getAttribute('data-id')); break;
      case 'eatAll': {
        const f = S.get(t.getAttribute('data-id'));
        S.consume(t.getAttribute('data-id'), 1);
        toast('✅ ' + (f ? f.name : '食材') + ' 已吃完，库存已更新');
        back();
        break;
      }
      case 'trash': openTrash(t.getAttribute('data-id')); break;
      case 'cleanExpired': openCleanup(); break;
      case 'confirmClean': {
        const ids = S.state.foods.filter(f => E.tier(f) === 'b').map(f => f.id);
        const n = S.trashMany(ids);
        closeModal();
        renderAll(false);
        toast('已清理 ' + n + ' 件过期食材');
        break;
      }

      case 'genWeek': {
        S.state.week = E.planWeek(S.state);
        S.save();
        if (APP.view.name === 'week') renderAll(false);
        else go({ name: 'week' });
        toast('已按家庭结构生成 7 天菜单');
        break;
      }
      case 'openParty': {
        S.state.party = null;
        S.save();
        go({ name: 'party' });
        break;
      }
      case 'genParty': {
        const P = w.DD_VIEW.party;
        const total = (P.men + P.women + P.kids) || 1;
        const wp = d.getElementById('partyWish');
        const tp = d.getElementById('partyTaste');
        const bp = d.getElementById('partyBudget');
        if (wp) P.wish = wp.value.trim();
        if (tp) P.taste = tp.value.trim();
        if (bp) P.budget = parseInt(bp.value, 10) || 0;
        S.state.party = E.partyPlan(S.state, {
          men: P.men, women: P.women, kids: P.kids,
          cuisine: P.cuisine, dateLabel: U.partyDateLabel(P.dateKey),
          wish: P.wish, taste: P.taste, budget: P.budget,
          avoid: (S.state.family && S.state.family.avoid) || []
        });
        S.save();
        renderAll(false);
        toast('已按 ' + total + ' 人排好这桌菜');
        break;
      }
      case 'partyStep': {
        const k = t.getAttribute('data-k');
        const dd = parseInt(t.getAttribute('data-d'), 10);
        const P = w.DD_VIEW.party;
        P[k] = Math.max(0, Math.min(12, (P[k] | 0) + dd));
        if (P.men + P.women + P.kids === 0) P[k] = 1;
        renderAll(false);
        break;
      }
      case 'clearPins':
        S.state.pinned = [];
        S.save();
        renderAll(false);
        toast('已取消全部置顶');
        break;
      case 'clearSearch':
        w.DD_VIEW.q = '';
        renderAll(false);
        break;
      case 'openChat': openChat(); break;
      case 'openNearby':
        go({ name: 'nearby' });
        if (w.DD_VIEW.nearby && w.DD_VIEW.nearby.src === '默认城市') autoLocate();
        break;
      case 'locate': autoLocate(); break;
      case 'findShops': findShops(); break;
      case 'toggleMap':
        w.DD_VIEW.showMap = !w.DD_VIEW.showMap;
        renderAll(false);
        break;
      case 'copyCart': {
        const list = (S.state.cart || []).map(c => c.name + ' ' + E.fmtQty(c.qty) + c.unit).join('\n');
        if (!list) { toast('采购清单是空的'); break; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('采购清单：\n' + list)
            .then(() => toast('清单已复制，可直接粘到备忘录'))
            .catch(() => toast('复制失败，请手动选择'));
        } else {
          toast('当前浏览器不支持复制');
        }
        break;
      }
      case 'chatSend': chatSend(); break;
      case 'back': back(); break;
      case 'toggleDark': {
        const cur = d.documentElement.dataset.theme === 'dark';
        d.documentElement.dataset.theme = cur ? 'light' : 'dark';
        try { localStorage.setItem('ddm.theme', d.documentElement.dataset.theme); } catch (e) {}
        renderAll(false);
        toast(cur ? '已切回浅色' : '已开启深色模式');
        break;
      }
      case 'exportData': {
        try {
          const blob = new Blob([JSON.stringify(S.state, null, 2)], { type: 'application/json' });
          const a = d.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'fridge-data-' + new Date().toISOString().slice(0, 10) + '.json';
          d.body.appendChild(a); a.click(); d.body.removeChild(a);
          toast('已导出 JSON');
        } catch (e) { toast('导出失败：' + e.message); }
        break;
      }
      case 'cartAddDish': {
        addDishMissingToCart(t.getAttribute('data-id'));
        break;
      }
      case 'playFrame': {
        const fr = d.getElementById('vframe');
        if (fr && !fr.querySelector('iframe')) {
          fr.innerHTML = '<iframe src="' + fr.getAttribute('data-src')
            + '" allowfullscreen frameborder="0" scrolling="no"></iframe>';
        }
        break;
      }
      case 'onbNext': {
        const nm = d.getElementById('onbName');
        if (nm) w.DD_VIEW.onb.name = nm.value.trim();
        w.DD_VIEW.onb.step = 2;
        renderAll(true);
        break;
      }
      case 'sendCode': {
        const ph = (d.getElementById('loginPhone') || {}).value || '';
        if (!/^1\d{10}$/.test(ph.trim())) { toast('先填 11 位手机号'); break; }
        w.DD_VIEW.login.phone = ph.trim();
        w.DD_VIEW.login.sent = true;
        renderAll(false);
        toast('验证码已发送：123456（演示）');
        break;
      }
      case 'loginSubmit': {
        const ph = ((d.getElementById('loginPhone') || {}).value || '').trim();
        const code = ((d.getElementById('loginCode') || {}).value || '').trim();
        if (!/^1\d{10}$/.test(ph)) { toast('请输入 11 位手机号'); break; }
        if (!w.DD_VIEW.login.sent) { toast('请先点「获取验证码」'); break; }
        if (code !== '123456') { toast('验证码不对，演示用 123456'); break; }
        S.login(ph);
        w.DD_VIEW.login.code = '';
        if (!(S.state.family.members || []).length) {
          if (!w.DD_VIEW.onb) w.DD_VIEW.onb = defaultOnb();
          w.DD_VIEW.onb.name = S.state.family.name || '我';
          APP.stack = [];
          APP.view = { name: 'family' };
          renderAll(true);
          toast('登录成功，先录一下家里几口人');
        } else {
          APP.stack = [];
          APP.view = { name: 'me' };
          renderAll(true);
          toast('登录成功');
        }
        break;
      }
      case 'loginDemo': {
        S.demoFamily();
        S.state.week = E.planWeek(S.state);
        S.save();
        APP.stack = [];
        APP.view = { name: 'fridge' };
        renderAll(true);
        toast('已用示例家庭进入');
        break;
      }
      case 'logout': {
        S.logout();
        APP.stack = [];
        APP.view = { name: 'me' };
        renderAll(true);
        toast('已退出登录');
        break;
      }
      case 'famDone':
        finishOnboarding();
        break;
      case 'onbBack':
        w.DD_VIEW.onb.step = 1;
        renderAll(true);
        break;
      case 'onbAdd':
        w.DD_VIEW.onb.members.push({ name: '', role: '成人', gender: '女', age: 30 });
        renderAll(false);
        break;
      case 'onbPreset': {
        const presets = {
          two: [
            { name: '我', role: '成人', gender: '女', age: 30 },
            { name: '老公', role: '成人', gender: '男', age: 32 }
          ],
          three: [
            { name: '我', role: '成人', gender: '女', age: 34 },
            { name: '老公', role: '成人', gender: '男', age: 36 },
            { name: '宝宝', role: '幼儿', gender: '男', age: 3 }
          ],
          four: [
            { name: '我', role: '成人', gender: '女', age: 34 },
            { name: '老公', role: '成人', gender: '男', age: 36 },
            { name: '宝宝', role: '幼儿', gender: '男', age: 3 },
            { name: '奶奶', role: '老人', gender: '女', age: 68 }
          ]
        };
        const k = t.getAttribute('data-p');
        if (presets[k]) w.DD_VIEW.onb.members = presets[k].slice();
        renderAll(false);
        break;
      }
      case 'onbDel': {
        const i = parseInt(t.getAttribute('data-i'), 10);
        if (w.DD_VIEW.onb.members.length > 1) w.DD_VIEW.onb.members.splice(i, 1);
        renderAll(false);
        break;
      }
      case 'onbDone':
        finishOnboarding();
        break;
      case 'onbSkip': {
        S.demoFamily();
        S.state.week = E.planWeek(S.state);
        S.save();
        APP.stack = [];
        APP.view = { name: 'fridge' };
        renderAll(true);
        toast('已用示例家庭进入，随时可在「我的」里改');
        break;
      }
      case 'cartAdd': {
        const p = S.state.party;
        if (p && p.missing.length) {
          S.addCart(p.missing);
          toast('已加入采购清单 ' + p.missing.length + ' 项');
          tabTo('plan');
        } else toast('没有需要补购的食材');
        break;
      }
      case 'cartBuy': {
        const n = S.buyCart();
        toast('🛒 ' + n + ' 项已入库');
        renderAll(false);
        break;
      }
      case 'cartClear': S.clearCart(); renderAll(false); toast('清单已清空'); break;

      case 'travel': {
        const n = parseInt(t.getAttribute('data-days'), 10);
        S.travel(n);
        S.state.week = null;
        S.save();
        renderAll(false);
        toast('时间已调整 ' + (n > 0 ? '+' : '') + n + ' 天，看四色变化');
        break;
      }
      case 'reset': openReset(); break;
      case 'editFamily': openFamily(); break;
      case 'famSave': saveFamily(); break;
      case 'famAdd': {
        readFamDraft();
        FAMD.members.push({ role: '成人', age: 30 });
        drawFamily();
        break;
      }
      case 'famDel': {
        readFamDraft();
        const i = parseInt(t.getAttribute('data-i'), 10);
        if (FAMD.members.length > 1) FAMD.members.splice(i, 1);
        drawFamily();
        break;
      }
      case 'camOpenFile': {
        const inp = d.getElementById('camFile');
        if (inp) inp.click();
        break;
      }
      case 'camSample': camSample(); break;
      case 'camConfirm': camConfirm(); break;
      case 'applyEat': applyEat(); break;
      case 'doTrash': {
        const id = d.getElementById('trashYes').getAttribute('data-id');
        S.trash(id);
        closeModal();
        back();
        toast('已清理');
        break;
      }
      case 'resetYes': {
        S.reset();
        APP.stack = [];
        APP.view = { name: 'fridge' };
        w.DD_VIEW = { filter: 'all', recTab: 'fit', q: '', people: 4, sugIdx: 0 };
        closeModal();
        renderAll(true);
        toast('已恢复示例数据');
        break;
      }
      default: break;
    }
  });

  backEl.addEventListener('click', back);

  const searchBtn = d.getElementById('navSearch');
  if (searchBtn) {
    searchBtn.addEventListener('click', function () {
      w.DD_VIEW.q = '';
      go({ name: 'search' });
    });
  }

  /* ============================================================
     输入
     ============================================================ */
  d.addEventListener('input', function (e) {
    if (e.target.id === 'loginPhone') { w.DD_VIEW.login.phone = e.target.value; return; }
    if (e.target.id === 'loginCode') { w.DD_VIEW.login.code = e.target.value; return; }
    if (e.target.id === 'partyWish') { w.DD_VIEW.party.wish = e.target.value; return; }
    if (e.target.id === 'partyTaste') { w.DD_VIEW.party.taste = e.target.value; return; }
    if (e.target.id === 'videoSearch') {
      w.DD_VIEW.vq = e.target.value;
      const pos = e.target.selectionStart;
      renderAll(false);
      const vs = d.getElementById('videoSearch');
      if (vs) { vs.focus(); try { vs.setSelectionRange(pos, pos); } catch (err) {} }
      return;
    }
    if (e.target.id === 'globalSearch') {
      w.DD_VIEW.q = e.target.value;
      const pos = e.target.selectionStart;
      renderAll(false);
      const g = d.getElementById('globalSearch');
      if (g) { g.focus(); try { g.setSelectionRange(pos, pos); } catch (err) {} }
      return;
    }
    if (e.target.hasAttribute('data-onb')) {
      const f = e.target.getAttribute('data-onb');
      const ob = w.DD_VIEW.onb;
      const i = +e.target.getAttribute('data-i');
      if (f === 'name') ob.name = e.target.value;
      if (f === 'taboos') ob.taboos = e.target.value;
      if (f === 'mname' && ob.members[i]) ob.members[i].name = e.target.value;
      if (f === 'role' && ob.members[i]) ob.members[i].role = e.target.value;
      if (f === 'gender' && ob.members[i]) ob.members[i].gender = e.target.value;
      if (f === 'age' && ob.members[i]) ob.members[i].age = parseInt(e.target.value, 10) || 0;
    }
    if (e.target.id === 'dishSearch') {
      w.DD_VIEW.q = e.target.value;
      const pos = e.target.selectionStart;
      renderAll(false);
      const el = d.getElementById('dishSearch');
      if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (err) {} }
    }
    if (e.target.hasAttribute('data-famfield')) {
      const f = e.target.getAttribute('data-famfield');
      const i = +e.target.getAttribute('data-i');
      if (f === 'name') FAMD.name = e.target.value;
      if (f === 'taboos') FAMD.taboos = e.target.value;
      if (f === 'role' && FAMD.members[i]) FAMD.members[i].role = e.target.value;
      if (f === 'age' && FAMD.members[i]) FAMD.members[i].age = parseInt(e.target.value, 10) || 0;
    }
    if (e.target.id === 'eatRange') {
      const v = parseInt(e.target.value, 10);
      d.getElementById('eatPct').textContent = v + '%';
      const btn = d.getElementById('eatQty');
      const q = parseFloat(btn.getAttribute('data-q'));
      const u = btn.getAttribute('data-u');
      d.getElementById('eatLeft').textContent = E.fmtQty(q * (1 - v / 100)) + ' ' + u;
    }
    if (e.target.id === 'updRange' && CAM) {
      CAM.ratio = parseInt(e.target.value, 10);
      const el = d.getElementById('updLeft');
      if (el) el.textContent = E.fmtQty(CAM.food.qty * CAM.ratio / 100) + ' ' + CAM.food.unit;
    }
  });

  d.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'chatInput') {
      e.preventDefault();
      chatSend();
    }
  });

  d.addEventListener('change', function (e) {
    if (e.target.id === 'camFile') {      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const rd = new FileReader();
      rd.onload = function (ev) {
        if (!CAM) return;
        CAM.img = ev.target.result;
        CAM.phase = 'scan';
        drawCamera();
        setTimeout(function () {
          if (CAM && CAM.phase === 'scan') { CAM.phase = 'result'; drawCamera(); }
        }, 1300);
      };
      rd.readAsDataURL(file);
    }
  });

  /* ============================================================
     拍照 / 识别 / 二次更新
     ============================================================ */
  let CAM = null;

  function openCamera(mode, id) {
    const food = id ? S.get(id) : null;
    if (mode === 'update' && !food) return;
    CAM = { mode: mode, foodId: id, food: food, phase: 'idle', img: null, scene: null, items: [], ratio: 60 };
    drawCamera();
  }

  function drawCamera() {
    if (!CAM) return;
    const isUpd = CAM.mode === 'update';
    const title = isUpd ? ('更新剩余 · ' + CAM.food.name) : '拍照入库';
    let body = '';

    if (CAM.phase === 'idle') {
      body = `
        <div class="shot"><div class="ph"><div class="e">📷</div>
          <div class="t">${isUpd ? '对着剩下的 ' + U.esc(CAM.food.name) + ' 拍一张' : '对着冰箱里的食材拍一张'}</div>
          <div class="t" style="font-weight:400;color:#C4BAAF;margin-top:2px">支持生鲜 / 包装食品混拍</div>
        </div></div>
        <div class="btn-row">
          <button class="btn ghost" data-action="camOpenFile">选择照片</button>
          <button class="btn primary" data-action="camSample">用示例图演示</button>
        </div>
        <input type="file" id="camFile" accept="image/*" capture="environment" hidden>
        <div class="small muted" style="margin-top:10px;line-height:1.6;text-align:center">
          演示环境没摄像头也能跑：点「用示例图」会生成一张模拟照片，走完整识别流程。
        </div>`;
    } else if (CAM.phase === 'scan') {
        body = `<div class="shot has-img"><img src="${CAM.img}" alt=""><div class="scanline"></div></div>
        <div class="small bold" style="text-align:center;margin-top:12px">🤖 AI 正在识别食材与保质期…</div>
        <div class="small muted" style="text-align:center;margin-top:4px">匹配食材库 2,000+ 条 · 读取包装日期</div>`;
    } else if (CAM.phase === 'result') {
      if (isUpd) {
        body = `
          <div class="shot has-img"><img src="${CAM.img}" alt=""></div>
          <div class="panel" style="box-shadow:none;background:#fff">
            <h3><span class="dot"></span>AI 识别结果</h3>
            <div class="p-body">
              ${U.esc(CAM.food.name)} ${CAM.food.emoji} · 判断剩余约
              <b style="font-size:16px;color:#FF5C7A">${CAM.ratio}%</b><br>
              <span class="muted">综合形状、体积与表面状态估算，可手动微调。</span>
            </div>
            <input type="range" min="5" max="100" step="5" value="${CAM.ratio}" id="updRange" style="margin-top:10px">
            <div class="row between mt6">
              <span class="tiny muted">剩余很少可拉到 5%</span>
              <span class="tiny muted">剩 <b id="updLeft">${E.fmtQty(CAM.food.qty * CAM.ratio / 100)} ${CAM.food.unit}</b></span>
            </div>
          </div>
          <div class="btn-row">
            <button class="btn ghost" data-action="camSample">重拍一张</button>
            <button class="btn primary" data-action="camConfirm">确认更新库存</button>
          </div>`;
      } else {
        body = `
          <div class="shot has-img"><img src="${CAM.img}" alt=""></div>
          <div class="row between" style="margin-top:12px">
            <div class="small bold">识别到 ${CAM.items.length} 件食材</div>
            <div class="tiny muted">${U.esc(CAM.scene ? CAM.scene.label : '')}</div>
          </div>
          ${CAM.items.map((it, i) => `<div class="res">
            <div class="em">${it.emoji}</div>
            <div class="in">
              <div class="nm">${U.esc(it.name)} <span class="cf">${it.conf}%</span></div>
              <div class="sub">${U.esc(it.cat)} · 标准保质期 ${it.shelf} 天 · ${U.esc(it.storage)}</div>
            </div>
            <div class="qtybox">
              <button data-cam-step="-1" data-i="${i}">−</button>
              <span>${E.fmtQty(it.qty)} ${U.esc(it.unit)}</span>
              <button data-cam-step="1" data-i="${i}">+</button>
            </div>
          </div>`).join('')}
          <div class="btn-row">
            <button class="btn ghost" data-action="camSample">重拍</button>
            <button class="btn primary" data-action="camConfirm">确认入库 ${CAM.items.length} 件</button>
          </div>`;
      }
    }

    openModal(`
      <div class="sheet-head"><div class="t">${U.esc(title)}</div>
        <button class="x" data-action="closeModal">✕</button></div>
      ${body}`);
  }

  function camStep(dir, i) {
    if (!CAM) return;
    const n = parseInt(dir, 10);
    const it = CAM.items[+i];
    if (!it) return;
    const step = it.unit === 'g' ? 50 : (it.qty < 1 ? 0.5 : 1);
    it.qty = Math.max(step, Math.round((it.qty + n * step) * 10) / 10);
    drawCamera();
  }

  function camSample() {
    if (!CAM) return;
    const scene = D.PHOTO_SCENES[Math.floor(Math.random() * D.PHOTO_SCENES.length)];
    CAM.scene = scene;
    CAM.items = scene.items.map(function (it) {
      const m = E.foodMeta(it.name);
      return {
        name: it.name, emoji: m.emoji, cat: m.cat, unit: m.unit,
        shelf: m.shelf, storage: m.storage || '冷藏',
        qty: it.qty, conf: 88 + Math.floor(Math.random() * 11)
      };
    });
    CAM.img = makeSampleImage(
      CAM.mode === 'update' ? [{ name: CAM.food.name, conf: 96 }] : CAM.items,
      CAM.mode === 'update' ? ('剩菜盒 · ' + CAM.food.name) : scene.label
    );
    CAM.phase = 'scan';
    drawCamera();
    setTimeout(function () {
      if (CAM && CAM.phase === 'scan') { CAM.phase = 'result'; drawCamera(); }
    }, 1300);
  }

  /* 生成一张"模拟照片"：冰箱背景 + AI 识别框，无需真实摄像头 */
  function makeSampleImage(items, label) {
    const c = d.createElement('canvas');
    c.width = 900; c.height = 240;
    const g = c.getContext('2d');

    const grad = g.createLinearGradient(0, 0, 900, 240);
    grad.addColorStop(0, '#E7EFF4');
    grad.addColorStop(1, '#F4F9FA');
    g.fillStyle = grad;
    g.fillRect(0, 0, 900, 240);

    // 层板
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.fillRect(0, 194, 900, 12);
    g.fillStyle = 'rgba(140,165,180,.16)';
    g.fillRect(0, 206, 900, 5);

    const palette = ['#F97362', '#7FC36B', '#E0A98B', '#F2C14E', '#8ECBDD', '#C48BC9'];
    const list = (items || []).slice(0, 3);

    list.forEach(function (it, i) {
      const step = 900 / list.length;
      const x = Math.round(step * i + (step - 250) / 2), y = 48, wd = 250, ht = 142;
      const cx = x + wd / 2, cy = y + ht / 2 + 6;

      // 食材主体（简化色块）
      g.fillStyle = palette[i % palette.length];
      g.beginPath();
      g.ellipse(cx, cy, 54, 44, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.34)';
      g.beginPath();
      g.ellipse(cx - 16, cy - 15, 17, 13, -0.5, 0, Math.PI * 2);
      g.fill();

      // 识别框
      g.strokeStyle = '#22C55E';
      g.lineWidth = 3;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, wd, ht, 16); else g.rect(x, y, wd, ht);
      g.stroke();

      // 识别标签
      const txt = it.name + ' ' + (it.conf || 95) + '%';
      g.font = '700 18px "Microsoft YaHei",sans-serif';
      const tw = g.measureText(txt).width + 22;
      g.fillStyle = '#22C55E';
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y - 30, tw, 30, 9); else g.rect(x, y - 30, tw, 30);
      g.fill();
      g.fillStyle = '#fff';
      g.fillText(txt, x + 11, y - 8);
    });

    // 说明
    g.fillStyle = 'rgba(31,36,48,.42)';
    g.font = '600 15px "Microsoft YaHei",sans-serif';
    g.fillText('示例照片 · ' + label, 26, 232);

    return c.toDataURL('image/png');
  }

  function camConfirm() {
    if (!CAM) return;
    if (CAM.mode === 'update') {
      const fid = CAM.foodId, unitTxt = CAM.food.unit, fname = CAM.food.name;
      const q = Math.round(CAM.food.qty * CAM.ratio) / 100;
      S.setQty(fid, q);
      closeModal();
      toast('已更新：' + fname + ' 剩余 ' + E.fmtQty(q) + ' ' + unitTxt);
      APP.view = S.get(fid) ? { name: 'food', id: fid } : { name: 'fridge' };
      renderAll(true);
      return;
    }
    let n = 0, urgent = 0;
    CAM.items.forEach(function (it) {
      const f = S.add(it.name, it.qty, it.shelf);
      if (E.tier(f) !== 'g') urgent++;
      n++;
    });
    closeModal();
    tabTo('fridge');
    toast('已入库 ' + n + ' 件食材' + (urgent ? '，其中 ' + urgent + ' 件需尽快食用' : ''));
  }

  /* ============================================================
     吃掉 / 丢弃 / 临期菜单
     ============================================================ */
  let EAT_ID = null;

  function openEat(id) {
    const f = S.get(id);
    if (!f) return;
    EAT_ID = id;
    openModal(`
      <div class="sheet-head"><div class="t">吃掉一部分 · ${U.esc(f.name)}</div>
        <button class="x" data-action="closeModal">✕</button></div>
      <div class="panel" style="background:#fff;box-shadow:none">
        <div class="p-body" style="margin-top:0">当前 ${E.fmtQty(f.qty)} ${U.esc(f.unit)}。拖动滑块选择这次用掉多少，库存立刻更新。</div>
        <div class="row between" style="margin-top:12px">
          <span class="small bold">这次用掉</span>
          <span class="small bold" style="color:#FF5C7A" id="eatPct">50%</span>
        </div>
        <input type="range" id="eatRange" min="0" max="100" step="10" value="50" style="margin-top:8px">
        <div class="row between mt6">
          <span class="tiny muted">剩余</span>
          <span class="tiny bold" id="eatLeft">${E.fmtQty(f.qty * 0.5)} ${U.esc(f.unit)}</span>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn ghost" data-action="closeModal">取消</button>
        <button class="btn primary" data-action="applyEat" id="eatQty"
          data-q="${f.qty}" data-u="${U.esc(f.unit)}">确认</button>
      </div>`);
  }

  function applyEat() {
    const r = d.getElementById('eatRange');
    const pct = r ? parseInt(r.value, 10) : 50;
    const f = S.get(EAT_ID);
    if (!f) { closeModal(); return; }
    const res = S.consume(EAT_ID, pct / 100);
    closeModal();
    if (res.removed) {
      toast('✅ ' + f.name + ' 已全部用完' + (res.saved ? '，挽回 ¥' + res.saved.toFixed(1) : ''));
      APP.view = { name: 'fridge' };
    } else {
      toast('已更新：' + f.name + ' 剩 ' + E.fmtQty(res.left) + ' ' + f.unit + '，可再拍照更新');
    }
    renderAll(true);
  }

  function openTrash(id) {
    const f = S.get(id);
    if (!f) return;
    openModal(`
      <div class="sheet-head"><div class="t">确认丢弃？</div>
        <button class="x" data-action="closeModal">✕</button></div>
      <div class="panel" style="background:#fff;box-shadow:none">
        <div class="p-body" style="margin-top:0">${U.esc(f.name)} · ${E.fmtQty(f.qty)} ${U.esc(f.unit)}<br>
        丢弃后会从库存移除，并计入「清理过期」统计。</div>
      </div>
      <div class="btn-row">
        <button class="btn ghost" data-action="closeModal">还没坏，留着</button>
        <button class="btn primary" data-action="doTrash" id="trashYes" data-id="${f.id}">确认丢弃</button>
      </div>`);
  }

  function openCleanup() {
    const bad = S.state.foods.filter(f => E.tier(f) === 'b');
    if (!bad.length) { toast('没有过期食材'); return; }
    openModal(`
      <div class="sheet-head"><div class="t">⚫ 清理过期食材</div>
        <button class="x" data-action="closeModal">✕</button></div>
      <div class="small muted" style="margin-bottom:8px">过期食材禁止食用，早点清理可以避免污染其他食材。</div>
      <div class="panel" style="background:#fff;box-shadow:none">
        ${bad.map(f => `<div class="ing"><div class="l">${f.emoji} ${U.esc(f.name)}</div>
          <div class="q">${E.fmtQty(f.qty)} ${U.esc(f.unit)} · ${E.dayText(f)}</div></div>`).join('')}
      </div>
      <div class="btn-row">
        <button class="btn ghost" data-action="closeModal">先留着</button>
        <button class="btn primary" data-action="confirmClean">全部清理 ${bad.length} 件</button>
      </div>`);
  }

  function openUrgentMenu() {    const st = S.state;
    const urgent = E.urgentList(st.foods);
    if (!urgent.length) { toast('暂时没有临期食材'); return; }
    const names = urgent.map(f => f.name);
    const cands = D.DISHES.filter(d => d.ingredients.some(i => names.indexOf(i.name) >= 0))
      .map(d => ({ d: d, st: E.ingredientState(d, st.foods) }))
      .sort(function (a, b) {
        const cost = x => x.st.filter(s => !s.ok).length;
        const gain = x => x.d.ingredients.filter(i => names.indexOf(i.name) >= 0).length;
        return (cost(a) - cost(b)) || (gain(b) - gain(a));
      }).slice(0, 4);

    openModal(`
      <div class="sheet-head"><div class="t">🟣 临期优先菜单</div>
        <button class="x" data-action="closeModal">✕</button></div>
      <div class="small muted" style="margin-bottom:8px">
        今天必须处理：${urgent.map(f => f.emoji + f.name).join(' · ')}
      </div>
      ${cands.map(x => `<button class="res" style="width:100%;text-align:left" data-dish="${x.d.id}">
        <div class="em">${x.d.emoji}</div>
        <div class="in"><div class="nm">${U.esc(x.d.name)}
          ${x.st.every(s => s.ok) ? '<span class="cf">现在能做</span>'
            : '<span class="cf" style="color:#C2410C;background:#FFEDD5">缺 ' + x.st.filter(s => !s.ok).length + ' 样</span>'}
        </div>
        <div class="sub">${U.esc(x.d.ingredients.map(i => i.name).join(' + '))} · ${x.d.minutes} 分钟</div></div>
        <div style="font-size:12px;color:#FF5C7A;font-weight:800">›</div>
      </button>`).join('')}
      <div class="btn-row"><button class="btn ghost" data-action="genWeek">让 AI 排一周 ›</button></div>`);
  }

  /* ============================================================
     做菜（扣减库存）
     ============================================================ */
  function doCook(id) {
    const dish = D.DISHES.filter(x => x.id === id)[0];
    if (!dish) return;
    const st = S.state;
    const states = E.ingredientState(dish, st.foods);
    const missing = states.filter(s => !s.ok);
    if (missing.length) {
      toast('还差：' + missing.map(m => m.name).join('、') + '，先去补料');
      return;
    }
    const res = E.cook(dish, st);
    S.save();
    const left = res.used.filter(u => u.left > 0);
    APP.view = { name: 'fridge' };
    renderAll(true);
    openModal(`
      <div class="sheet-head"><div class="t">✅ 做完啦，库存已更新</div>
        <button class="x" data-action="closeModal">✕</button></div>
      <div class="panel" style="background:#fff;box-shadow:none">
        <h3><span class="dot"></span>${U.esc(dish.name)} 已扣减</h3>
        <div class="p-body" style="padding:0">
          ${res.used.map(u => `<div class="ing"><div class="l">${E.foodMeta(u.name).emoji} ${U.esc(u.name)}</div>
            <div class="q">-${E.fmtQty(u.qty)} ${U.esc(u.unit)} · 剩 ${E.fmtQty(u.left)} ${U.esc(u.unit)}</div></div>`).join('')}
        </div>
        ${left.length ? `<div class="p-body" style="color:#6D28D9;background:#F7F2FF;border-radius:10px;padding:8px 10px;margin-top:8px">
          🟣 还有剩余食材？点下面「拍剩余量」，AI 重新识别后更新库存，再匹配新菜谱。</div>` : ''}
      </div>
      <div class="btn-row">
        <button class="btn ghost" data-action="closeModal">关闭</button>
        <button class="btn primary" data-action="shoot">📷 拍剩余量</button>
      </div>`);
  }

  /* ============================================================
     家庭设置
     ============================================================ */
  let FAMD = null;

  function openFamily() {
    FAMD = JSON.parse(JSON.stringify(S.state.family));
    drawFamily();
  }

  function drawFamily() {
    openModal(`
      <div class="sheet-head"><div class="t">家庭档案</div>
        <button class="x" data-action="closeModal">✕</button></div>
      <div class="panel" style="background:#fff;box-shadow:none">
        <div class="field"><div class="lab">家庭称呼</div>
          <input type="text" data-famfield="name" data-i="0" value="${U.esc(FAMD.name)}" maxlength="8"></div>
        ${FAMD.members.map((m, i) => `<div class="field">
          <div class="lab">成员 ${i + 1}<small>年龄会影响菜的软硬度</small></div>
          <div class="row gap6">
            <select data-famfield="role" data-i="${i}">
              ${['成人', '老人', '幼儿'].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
            <input type="number" data-famfield="age" data-i="${i}" value="${m.age}" min="0" max="120" style="width:64px">
            <button class="chip" style="padding:5px 8px" data-action="famDel" data-i="${i}">删</button>
          </div>
        </div>`).join('')}
        <div class="field"><div class="lab">忌口 / 不吃<small>会从菜单里排除</small></div>
          <input type="text" data-famfield="taboos" data-i="0" value="${U.esc(FAMD.taboos || '')}" placeholder="如：香菜、辣" maxlength="20"></div>
      </div>
      <div class="btn-row">
        <button class="btn ghost" data-action="famAdd">+ 加成员</button>
        <button class="btn primary" data-action="famSave">保存</button>
      </div>`);
  }

  function readFamDraft() {
    modalEl.querySelectorAll('[data-famfield]').forEach(function (el) {
      const f = el.getAttribute('data-famfield');
      const i = +el.getAttribute('data-i');
      if (f === 'name') FAMD.name = el.value;
      if (f === 'taboos') FAMD.taboos = el.value;
      if (f === 'role' && FAMD.members[i]) FAMD.members[i].role = el.value;
      if (f === 'age' && FAMD.members[i]) FAMD.members[i].age = parseInt(el.value, 10) || 0;
    });
  }

  function saveFamily() {
    readFamDraft();
    if (!FAMD.name) FAMD.name = '家长';
    S.saveFamily(FAMD);
    S.state.week = null;
    S.save();
    closeModal();
    renderAll(false);
    toast('家庭档案已保存，菜单会按新结构重排');
  }

  function openReset() {
    openModal(`
      <div class="sheet-head"><div class="t">恢复示例数据？</div>
        <button class="x" data-action="closeModal">✕</button></div>
      <div class="panel" style="background:#fff;box-shadow:none">
        <div class="p-body" style="margin-top:0">冰箱、采购清单和统计都会重置为初始的 18 件食材，用于重新演示。</div>
      </div>
      <div class="btn-row">
        <button class="btn ghost" data-action="closeModal">取消</button>
        <button class="btn primary" data-action="resetYes">确认重置</button>
      </div>`);
  }

  /* ============================================================
     注册引导 / 视频
     ============================================================ */
  function finishOnboarding() {
    const ob = w.DD_VIEW.onb;
    const members = ob.members.map(function (m, i) {
      return {
        name: (m.name || '').trim() || ('家人' + (i + 1)),
        role: m.role || '成人',
        gender: m.gender || '女',
        age: Math.max(0, Math.min(110, m.age | 0))
      };
    });
    if (!members.length) members.push({ name: '我', role: '成人', gender: '女', age: 30 });

    S.saveFamily({
      registered: true,
      name: (ob.name || '家长').trim() || '家长',
      members: members,
      taboos: (ob.taboos || '').trim()
    });
    S.state.week = E.planWeek(S.state);
    S.save();
    APP.stack = [];
    APP.view = { name: 'fridge' };
    renderAll(true);
    toast('已按 ' + members.length + ' 位家人排好今天的菜单');
  }

  /* 外部链接：能开就新标签打开，被拦就给可复制的链接 */
  function openExternal(url) {
    if (!url) return;
    let win = null;
    try { win = w.open(url, '_blank', 'noopener'); } catch (err) { win = null; }
    if (win) return;
    openModal(`
      <div class="sheet-head"><div class="t">在新标签打开</div>
        <button class="x" data-action="closeModal">✕</button></div>
      <div class="panel" style="background:#fff;box-shadow:none">
        <div class="p-body" style="margin-top:0">浏览器拦住了自动打开。点下面的按钮，或复制链接到地址栏。</div>
        <div class="linkbox">${U.esc(url)}</div>
      </div>
      <div class="btn-row">
        <button class="btn ghost" data-action="closeModal">关闭</button>
        <a class="btn primary" href="${U.esc(url)}" target="_blank" rel="noopener">打开链接</a>
      </div>`);
  }

  function openVideo(bvid, title) {    const src = E.videoEmbed(bvid);
    openModal(`
      <div class="sheet-head"><div class="t">视频对照做菜</div>
        <button class="x" data-action="closeModal">✕</button></div>
      <div class="vframe" id="vframe" data-src="${src}">
        <button class="vposter" data-action="playFrame">
          <span class="vplay">▶</span>
          <span class="vcap">${U.esc(title || '示范视频')}</span>
          <span class="vsub">点一下加载哔哩哔哩播放器</span>
        </button>
      </div>
      <div class="small muted" style="margin-top:10px;line-height:1.6">
        视频来自哔哩哔哩官方播放器。如果这里加载不出来，点下面按钮到原页面看。
      </div>
      <div class="btn-row">
        <a class="btn ghost" href="${E.videoPage(bvid)}" target="_blank" rel="noopener">在 B 站打开</a>
        <button class="btn primary" data-action="closeModal">继续做菜</button>
      </div>`);
  }

  /* ============================================================
     计时器 / 语音 / 对话助手
     ============================================================ */
  function fmtSec(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  function beep() {
    try {
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      [0, 0.55, 1.1].forEach(function (t, i) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 880 - i * 70;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.32);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4);
      });
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 2200);
    } catch (e) { /* 静默失败 */ }
  }

  function startTimer(btn) {
    const orig = parseInt(btn.getAttribute('data-timer'), 10) || 60;
    if (btn._tid) {
      clearInterval(btn._tid); btn._tid = null;
      btn.classList.remove('on');
      btn.textContent = '⏱ ' + fmtSec(orig);
      return;
    }
    let left = orig;
    btn.classList.add('on');
    btn.textContent = '⏱ ' + fmtSec(left);
    btn._tid = setInterval(function () {
      left--;
      if (left <= 0) {
        clearInterval(btn._tid); btn._tid = null;
        btn.classList.remove('on');
        btn.textContent = '⏱ 时间到';
        beep();
        toast('⏰ 计时结束，看看锅里');
        setTimeout(function () { btn.textContent = '⏱ ' + fmtSec(orig); }, 2600);
        return;
      }
      btn.textContent = '⏱ ' + fmtSec(left);
    }, 1000);
  }

  function speak(text) {
    if (!('speechSynthesis' in w)) { toast('当前浏览器不支持语音朗读'); return; }
    try {
      w.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.95;
      w.speechSynthesis.speak(u);
    } catch (e) { toast('朗读失败'); }
  }

  function openChat() {
    if (!w.DD_VIEW.chat) {
      w.DD_VIEW.chat = [{
        role: 'bot',
        text: '我是冰箱管家 🧊 可以问我：今晚吃什么、什么快坏了、冰箱还有啥、该买什么，或者「怎么做番茄炒蛋」。'
      }];
    }
    drawChat();
  }

  function drawChat() {
    const msgs = w.DD_VIEW.chat;
    const last = msgs[msgs.length - 1];
    const chips = (last && last.role === 'bot' && last.chips) ? last.chips : [];
    openModal(`
      <div class="sheet-head"><div class="t">🤖 问问冰箱</div>
        <button class="x" data-action="closeModal">✕</button></div>
      <div class="chat" id="chatBox">
        ${msgs.map(function (m) { return `<div class="msg ${m.role}">${U.esc(m.text)}</div>`; }).join('')}
      </div>
      ${chips.length ? `<div class="chat-chips">${chips.map((c, i) => `<button class="chip" data-chip="${i}">${U.esc(c.label)}</button>`).join('')}</div>` : ''}
      <div class="chat-input">
        <input id="chatInput" placeholder="比如：今晚吃什么" maxlength="30">
        <button class="chat-send" data-action="chatSend">发送</button>
      </div>
      <div class="chat-tips">也可以直接说：「土豆能做什么」「清淡点的菜」「这周浪费了多少」</div>`);
    setTimeout(function () {
      const box = d.getElementById('chatBox');
      if (box) box.scrollTop = box.scrollHeight;
      const inp = d.getElementById('chatInput');
      if (inp) inp.focus();
    }, 40);
  }

  function chatAsk(q) {
    if (!q || !String(q).trim()) return;
    w.DD_VIEW.chat.push({ role: 'me', text: String(q).trim() });
    const res = E.assistant(q, S.state);
    w.DD_VIEW.chat.push({ role: 'bot', text: res.reply, chips: res.chips });
    drawChat();
  }

  function chatSend() {
    const inp = d.getElementById('chatInput');
    chatAsk(inp ? inp.value : '');
  }

  function addDishMissingToCart(id) {
    const dd = D.DISHES.filter(x => x.id === id)[0];
    if (!dd) return;
    const miss = E.ingredientState(dd, S.state.foods).filter(s => !s.ok);
    if (!miss.length) { toast('食材都够，不用买'); return; }
    S.addCart(miss.map(m => ({
      name: m.name, emoji: m.emoji, unit: m.unit,
      qty: Math.max(0.1, Math.round((m.qty - m.haveQty) * 10) / 10),
      price: E.foodMeta(m.name).price || 0
    })));
    toast('已加入采购清单 ' + miss.length + ' 样');
    tabTo('plan');
  }

  function runChip(i) {
    const msgs = w.DD_VIEW.chat || [];
    const last = msgs[msgs.length - 1];
    if (!last || !last.chips) return;
    const c = last.chips[i];
    if (!c) return;
    if (c.ask) { chatAsk(c.ask); return; }
    closeModal();
    if (c.dish) { go({ name: 'dish', id: c.dish }); return; }
    if (c.view) {
      if (c.view === 'week') {
        if (!S.state.week) { S.state.week = E.planWeek(S.state); S.save(); }
        go({ name: 'week' });
      } else if (c.view === 'fridge') tabTo('fridge');
      else if (c.view === 'plan') tabTo('plan');
      else go({ name: c.view });
      return;
    }
    if (c.addCart) { addDishMissingToCart(c.addCart); return; }
    if (c.action === 'genWeek') {
      S.state.week = E.planWeek(S.state); S.save();
      go({ name: 'week' });
    } else if (c.action === 'genMenu') openUrgentMenu();
    else if (c.action === 'cleanExpired') openCleanup();
    else if (c.action === 'shoot') openCamera('add');
  }

  /* ============================================================
     附近超市（定位 + OpenStreetMap 真实点位）
     ============================================================ */
  const CITY_COORDS = {
    杭州: [30.2741, 120.1551], 北京: [39.9042, 116.4074], 上海: [31.2304, 121.4737],
    深圳: [22.5431, 114.0579], 广州: [23.1291, 113.2644], 成都: [30.5728, 104.0668],
    武汉: [30.5928, 114.3055], 西安: [34.3416, 108.9398]
  };

  function distanceM(lat1, lng1, lat2, lng2) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function autoLocate() {
    const N = w.DD_VIEW.nearby;
    if (!navigator.geolocation) {
      N.status = 'denied';
      renderAll(false);
      return;
    }
    N.status = 'locating';
    renderAll(false);
    navigator.geolocation.getCurrentPosition(function (pos) {
      N.lat = pos.coords.latitude;
      N.lng = pos.coords.longitude;
      N.src = '浏览器定位';
      N.status = 'idle';
      N.shops = [];
      renderAll(false);
      toast('已定位，正在找附近超市');
      findShops();
    }, function () {
      N.status = 'denied';
      N.src = '默认城市';
      renderAll(false);
      toast('没拿到定位权限，已用默认城市');
    }, { timeout: 8000, maximumAge: 60000 });
  }

  function findShops() {
    const N = w.DD_VIEW.nearby;
    if (!N.lat) { autoLocate(); return; }
    N.status = 'loading';
    N.shops = [];
    renderAll(false);
    const q = '[out:json][timeout:12];('
      + 'node["shop"="supermarket"](around:2500,' + N.lat + ',' + N.lng + ');'
      + 'node["shop"="convenience"](around:1200,' + N.lat + ',' + N.lng + ');'
      + ');out center 20;';
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q);
    const ctrl = new AbortController();
    const timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 9000);
    fetch(url, { signal: ctrl.signal })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(timer);
        const list = (j.elements || []).map(function (e) {
          const lat = e.lat, lng = e.lon;
          if (!lat || !lng) return null;
          return {
            name: (e.tags && e.tags.name) || '未命名超市',
            kind: (e.tags && e.tags.shop) === 'convenience' ? '便利店' : '超市',
            dist: Math.round(distanceM(N.lat, N.lng, lat, lng)),
            lat: lat, lng: lng
          };
        }).filter(Boolean).sort(function (a, b) { return a.dist - b.dist; }).slice(0, 6);
        N.shops = list;
        N.status = list.length ? 'ok' : 'fail';
        renderAll(false);
      })
      .catch(function () {
        clearTimeout(timer);
        N.status = 'fail';
        N.shops = [];
        renderAll(false);
      });
  }

  /* ============================================================
     启动
     ============================================================ */
  S.load();
  tick();
  setInterval(tick, 20000);

  // 主题：优先用上次选择的
  try {
    const th = localStorage.getItem('ddm.theme');
    if (th) d.documentElement.dataset.theme = th;
  } catch (e) {}

  APP.view = S.state.family.loggedIn ? viewFromHash() : { name: 'login' };
  renderAll(true);

  // PWA：注册 service worker（file:// 下会失败，忽略即可）
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  w.DD_APP = { go: go, tabTo: tabTo, back: back, render: renderAll };
})(window, document);
