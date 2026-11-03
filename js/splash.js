/* ============================================================
   开屏动画：会说话的小机器人
   ============================================================ */
(function () {
  const w = window, d = document;
  let timer = null, typing = null, muted = true, audioCtx = null;

  /* ---------------- 开机动画：爆炸性启动 ---------------- */
  function boot() {
    if (d.querySelector('.boot')) return;
    const parts = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2;
      const d1 = 90 + Math.random() * 190;
      parts.push(`<i style="--tx:${(Math.cos(a) * d1).toFixed(0)}px;--ty:${(Math.sin(a) * d1).toFixed(0)}px`
        + `;animation-delay:${(Math.random() * 120).toFixed(0)}ms`
        + `;width:${4 + Math.random() * 6}px;height:${4 + Math.random() * 6}px`
        + `;background:${['#7DEBFF', '#2FD79E', '#FFFFFF', '#FFD166', '#FF8A5B'][i % 5]}"></i>`);
    }
    const foods = ['🍅', '🥬', '🥚', '🥛', '🍖', '🐟'];
    const foodParts = foods.map(function (f, i) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.42;
      const d1 = 150 + Math.random() * 60;
      return `<b style="--tx:${(Math.cos(a) * d1).toFixed(0)}px;--ty:${(Math.sin(a) * d1).toFixed(0)}px`
        + `;animation-delay:${(i * 28).toFixed(0)}ms">${f}</b>`;
    }).join('');

    const el = d.createElement('div');
    el.className = 'boot';
    el.innerHTML = `
      <div class="boot-crt"><i></i></div>
      <div class="boot-fridge">
        <svg viewBox="0 0 120 170">
          <rect class="bd" x="12" y="8" width="96" height="154" rx="16"/>
          <line class="bd" x1="12" y1="66" x2="108" y2="66"/>
          <line class="bd" x1="88" y1="24" x2="88" y2="50"/>
          <line class="bd" x1="88" y1="84" x2="88" y2="126"/>
        </svg>
        <span class="boot-leaf">🥬</span>
      </div>
      <div class="boot-burst">
        <div class="boot-flash"></div>
        <div class="boot-rays"></div>
        <div class="boot-ring"></div>
        <div class="boot-ring r2"></div>
        <div class="boot-ring r3"></div>
        <div class="boot-parts">${parts.join('')}${foodParts}</div>
      </div>
      <div class="boot-logo">冰箱<span>对对碰</span></div>
      <div class="boot-tag">AI 全生命周期 · 家庭食材智能管理</div>
      <div class="boot-tip">轻触跳过</div>
    `;
    d.body.appendChild(el);

    // 时间轴
    setTimeout(function () { el.classList.add('s1'); }, 60);    // CRT 亮线
    setTimeout(function () { el.classList.add('s2'); }, 420);   // 冰箱门描边
    setTimeout(function () { el.classList.add('s3'); beep(120, .18); }, 1020); // 爆开
    setTimeout(function () { el.classList.add('s4'); beep(720, .1); }, 1280);  // 标题砸入
    setTimeout(function () { el.classList.add('s5'); }, 2180);  // 收尾

    let jumped = false;
    function finish() {
      if (jumped) return;
      jumped = true;
      el.remove();
      open();
    }
    el.addEventListener('click', finish);
    setTimeout(finish, 2520);
  }

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
    const mouth = d.querySelector('.sp-robot .bot-mouth');
    if (mouth) mouth.classList.add('talking');
    node.classList.add('typing');
    typing = setInterval(function () {
      i++;
      node.textContent = text.slice(0, i);
      if (i % 2 === 0) beep(560 + Math.random() * 220, 0.035);
      if (i >= text.length) {
        clearInterval(typing);
        typing = null;
        node.classList.remove('typing');
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
        <svg class="sp-bot" viewBox="0 0 220 270" aria-label="冰箱管家">
          <defs>
            <linearGradient id="botShell" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4F5EE"/>
            </linearGradient>
            <linearGradient id="botFace" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0" stop-color="#22323C"/><stop offset="0.55" stop-color="#101B22"/><stop offset="1" stop-color="#070D11"/>
            </linearGradient>
            <linearGradient id="botApron" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#8FE6FF"/><stop offset="1" stop-color="#2E9BD6"/>
            </linearGradient>
            <linearGradient id="botRim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/>
              <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
            </linearGradient>
            <clipPath id="botFaceClip"><rect x="48" y="40" width="124" height="104" rx="38"/></clipPath>
          </defs>

          <!-- 地面投影 + 全息光环 -->
          <ellipse cx="110" cy="252" rx="64" ry="11" fill="#0E6B52" opacity=".13"/>
          <ellipse class="hud-ring" cx="110" cy="252" rx="78" ry="15" fill="none"
                   stroke="#4FD9FF" stroke-width="1.4" stroke-dasharray="7 9" opacity=".5"/>

          <!-- 耳机头梁（在头后面，从头顶绕过） -->
          <path d="M29 98 q0 -86 81 -86 q81 0 81 86" fill="none" stroke="#E9F7F1" stroke-width="10" stroke-linecap="round"/>
          <path d="M29 98 q0 -86 81 -86 q81 0 81 86" fill="none" stroke="#D3EDE1" stroke-width="2" stroke-linecap="round"/>

          <!-- 手臂 -->
          <path class="bot-arm up" d="M62 188 q-24 12 -26 42" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
          <circle cx="36" cy="234" r="10" fill="#fff" stroke="#DCF0E7" stroke-width="2"/>
          <path class="bot-arm down" d="M158 188 q24 12 26 42" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
          <circle cx="184" cy="234" r="10" fill="#fff" stroke="#DCF0E7" stroke-width="2"/>

          <!-- 身体 -->
          <rect x="50" y="162" width="120" height="90" rx="42" fill="url(#botShell)" stroke="#DCF0E7" stroke-width="2"/>
          <!-- 肩带 -->
          <path d="M78 160 q4 26 -2 44" fill="none" stroke="#BFE9F8" stroke-width="7" stroke-linecap="round"/>
          <path d="M142 160 q-4 26 2 44" fill="none" stroke="#BFE9F8" stroke-width="7" stroke-linecap="round"/>
          <!-- 围裙 + 胸口屏 -->
          <path d="M86 172 q24 -9 48 0 l-3 66 q-21 8 -42 0 z" fill="url(#botApron)" opacity=".95"/>
          <rect x="90" y="186" width="40" height="30" rx="10" fill="#FFFFFF" opacity=".96"/>
          <text x="110" y="207" text-anchor="middle" font-size="17">🥬</text>
          <circle cx="110" cy="228" r="4.5" fill="#FFFFFF" opacity=".85"/>

          <!-- 耳机罩 -->
          <circle cx="31" cy="96" r="18" fill="#fff" stroke="#DCF0E7" stroke-width="2"/>
          <circle cx="31" cy="96" r="8" fill="#CFE9DE"/>
          <circle cx="189" cy="96" r="18" fill="#fff" stroke="#DCF0E7" stroke-width="2"/>
          <circle cx="189" cy="96" r="8" fill="#CFE9DE"/>

          <!-- 头 -->
          <rect x="30" y="22" width="160" height="140" rx="54" fill="url(#botShell)" stroke="#DCF0E7" stroke-width="2"/>
          <!-- 侧面高光 -->
          <path d="M38 62 q-6 30 4 58" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".85"/>
          <rect x="48" y="40" width="124" height="104" rx="38" fill="url(#botFace)"/>

          <!-- 面屏流动反光 -->
          <g clip-path="url(#botFaceClip)">
            <g transform="rotate(16 60 100)">
              <rect class="face-gloss" x="-60" y="10" width="44" height="170" fill="#BFEFFF" opacity=".14"/>
            </g>
            <ellipse cx="86" cy="54" rx="36" ry="12" fill="#FFFFFF" opacity=".09"/>
          </g>

          <!-- 眼睛（发光弧） -->
          <g class="bot-eyes">
            <path class="bot-eye" d="M71 89 q14 -16 28 0" fill="none" stroke="#7DEBFF" stroke-width="9" stroke-linecap="round"/>
            <path class="bot-eye" d="M121 89 q14 -16 28 0" fill="none" stroke="#7DEBFF" stroke-width="9" stroke-linecap="round"/>
          </g>
          <!-- 嘴 -->
          <path class="bot-mouth" d="M100 113 q10 10 20 0" fill="none" stroke="#7DEBFF" stroke-width="6" stroke-linecap="round"/>

          <!-- 头顶小芽 -->
          <g class="bot-sprout">
            <path d="M110 22 q2 -16 0 -22" fill="none" stroke="#5FBF7C" stroke-width="4.5" stroke-linecap="round"/>
            <path d="M110 6 q-19 -4 -24 -18 q19 -2 24 18 z" fill="#6FD08C"/>
            <path d="M110 6 q19 -4 24 -18 q-19 -2 -24 18 z" fill="#8FE0A6"/>
          </g>
        </svg>
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
    boot();
  }

  w.DD_SPLASH = { open: open, close: close, auto: auto, boot: boot };
})();
