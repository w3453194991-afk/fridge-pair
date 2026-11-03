/* ============================================================
   开屏动画：会说话的小机器人
   ============================================================ */
(function () {
  const w = window, d = document;
  let timer = null, typing = null, muted = true, audioCtx = null;

  function line(text) {
    return '<div class="sp-line">' + text + '</div>';
  }

  function beep(freq, dur) {
    if (muted) return;
    try {
      if (!audioCtx) audioCtx = new (w.AudioContext || w.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = 0.018;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  function typeInto(node, text, speed, done) {
    let i = 0;
    const mouth = d.querySelector('.sp-robot .r-mouth');
    if (mouth) mouth.classList.add('talking');
    typing = setInterval(function () {
      i++;
      node.textContent = text.slice(0, i);
      if (i % 2 === 0) beep(560 + Math.random() * 220, 0.035);
      if (i >= text.length) {
        clearInterval(typing);
        typing = null;
        if (mouth) mouth.classList.remove('talking');
        if (done) setTimeout(done, 520);
      }
    }, speed);
  }

  function speakSequence(lines, done) {
    const box = d.querySelector('.sp-words');
    let idx = 0;
    function next() {
      if (idx >= lines.length) { if (done) done(); return; }
      const div = d.createElement('div');
      div.className = 'sp-line';
      box.appendChild(div);
      // 只保留最近 3 行
      while (box.children.length > 3) box.removeChild(box.firstChild);
      const text = lines[idx++];
      typeInto(div, text, 42, next);
    }
    next();
  }

  function data() {
    const st = w.DD_STORE.state;
    const urgent = w.DD_ENGINE.urgentList(st.foods);
    const bad = st.foods.filter(f => w.DD_ENGINE.tier(f) === 'b');
    const names = urgent.slice(0, 3).map(f => f.name);
    const lines = [];
    if (urgent.length) {
      lines.push('嘀嘀——冰箱体检完毕，发现 ' + urgent.length + ' 件临期食材！');
      lines.push(names.join('、') + (urgent.length > names.length ? ' 等' : '') + ' 快到期了，快吃掉！快吃掉！');
      if (bad.length) lines.push('另外还有 ' + bad.length + ' 件已经过期，记得清理哦。');
      else lines.push('点下面的按钮，我立刻给你排今天的菜。');
    } else if (bad.length) {
      lines.push('嘀嘀——有 ' + bad.length + ' 件食材过期了。');
      lines.push('快清理！快清理！别影响其他食材～');
    } else {
      lines.push('嘀嘀——冰箱状态满分，食材都很新鲜！');
      lines.push('今天想吃点什么？我可以帮你搭配营养。');
    }
    return { urgent: urgent, lines: lines };
  }

  function open() {
    if (d.querySelector('.splash')) return;
    const info = data();

    const el = d.createElement('div');
    el.className = 'splash';
    el.innerHTML = `
      <div class="sp-glow"></div>
      <div class="sp-bubbles">
        <i style="left:8%;animation-delay:0s">🍅</i>
        <i style="left:24%;animation-delay:1.2s">🥬</i>
        <i style="left:78%;animation-delay:.6s">🥚</i>
        <i style="left:90%;animation-delay:1.8s">🥛</i>
        <i style="left:56%;animation-delay:2.4s">🍖</i>
      </div>

      <button class="sp-skip" data-sp="skip">跳过</button>

      <div class="sp-robot">
        <div class="r-antenna"><span></span></div>
        <div class="r-head">
          <div class="r-ear l"></div>
          <div class="r-ear r"></div>
          <div class="r-face">
            <div class="r-eyes">
              <div class="r-eye"><i></i></div>
              <div class="r-eye"><i></i></div>
            </div>
            <div class="r-mouth"></div>
            <div class="cheek l"></div>
            <div class="cheek r"></div>
          </div>
        </div>
        <div class="r-body">
          <div class="r-screen">🥬</div>
          <div class="r-arm l"></div>
          <div class="r-arm r"></div>
        </div>
        <div class="sp-wave"><i></i><i></i><i></i></div>
      </div>

      <div class="sp-words"></div>

      <div class="sp-actions">
        <button class="sp-btn primary" data-sp="go">
          ${info.urgent.length ? '⚡ 帮我安排临期菜单' : '🍳 生成今天的菜单'}
        </button>
        <button class="sp-btn ghost" data-sp="skip">我自己逛逛</button>
      </div>
      <button class="sp-sound" data-sp="sound">🔇 声音</button>
    `;
    d.body.appendChild(el);

    beep(880, 0.12);
    setTimeout(function () { beep(1180, 0.1); }, 130);

    // 台词
    setTimeout(function () {
      speakSequence(info.lines, function () {});
    }, 700);

    // 按钮 1.1 秒就出现，不让人干等
    timer = setTimeout(function () {
      const a = d.querySelector('.sp-actions');
      if (a) a.classList.add('show');
    }, 1100);

    el.addEventListener('click', function (e) {
      const b = e.target.closest('[data-sp]');
      if (!b) return;
      const act = b.getAttribute('data-sp');
      if (act === 'sound') {
        muted = !muted;
        b.textContent = muted ? '🔇 声音' : '🔊 声音';
        if (!muted) beep(760, 0.12);
        return;
      }
      if (act === 'go') {
        close();
        if (info.urgent.length && w.DD_APP && w.DD_APP.openUrgentMenu) w.DD_APP.openUrgentMenu();
        else if (w.DD_APP && w.DD_APP.genTodayMenu) w.DD_APP.genTodayMenu();
        return;
      }
      close();
    });

    // 8 秒后自动显示按钮，避免用户干等
    timer = setTimeout(function () {
      const a = d.querySelector('.sp-actions');
      if (a) a.classList.add('show');
    }, 8000);
  }

  function close() {
    const el = d.querySelector('.splash');
    if (!el) return;
    if (typing) { clearInterval(typing); typing = null; }
    clearTimeout(timer);
    el.classList.add('out');
    setTimeout(function () { el.remove(); }, 420);
    try { sessionStorage.setItem('ddm.splash', '1'); } catch (e) {}
  }

  function auto() {
    try {
      if (sessionStorage.getItem('ddm.splash') === '1') return;
    } catch (e) {}
    open();
  }

  w.DD_SPLASH = { open: open, close: close, auto: auto };
})();
