/* ============================================================
   冰箱对对碰 · 视图层
   ============================================================ */
(function (w) {
  'use strict';
  const D = w.DD_DATA, E = w.DD_ENGINE, S = w.DD_STORE;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function em(name) { return E.foodMeta(name).emoji; }
  function unit(name) { return E.foodMeta(name).unit; }
  function qtyTxt(n, name) { return E.fmtQty(n) + ' ' + unit(name); }

  /* ---------------- 食材卡片 ---------------- */
  function foodCard(f) {
    const t = E.tier(f);
    return `<button class="food ${t}" data-food="${f.id}">
      <div class="fc-head">
        <div class="fc-ico">${f.emoji || em(f.name)}</div>
        <span class="pill">${t === 'b' ? '已过期' : E.TIERS[t].label}</span>
      </div>
      <div class="fc-name">${esc(f.name)}</div>
      <div class="fc-foot">
        <span class="qty">${E.fmtQty(f.qty)} ${esc(f.unit)}</span>
        <span class="d">${E.dayText(f)}</span>
      </div>
    </button>`;
  }

  /* ---------------- 四色环形图 ---------------- */
  function donutSvg(c, total) {
    const R = 38, C = 2 * Math.PI * R;
    const order = [['g', '#22C55E'], ['y', '#E9A50B'], ['p', '#8B5CF6'], ['b', '#525A6B']];
    let acc = 0, arcs = '';
    if (!total) return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${R}" fill="none" stroke="#F0EBE4" stroke-width="10"/></svg>`;
    order.forEach(function (it) {
      const n = c[it[0]] || 0;
      if (!n) return;
      const len = n / total * C;
      const dash = Math.max(len - 4, 1.6);
      arcs += `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${it[1]}" stroke-width="10"
        stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}"
        stroke-dashoffset="${(-acc).toFixed(2)}"/>`;
      acc += len;
    });
    return `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="${R}" fill="none" stroke="#F0EBE4" stroke-width="10"/>${arcs}</svg>`;
  }

  /* ---------------- 冰箱首页 ---------------- */
  function viewFridge() {
    const st = S.state;
    const foods = st.foods;
    const c = E.counts(foods);
    const sug = E.topSuggestion(foods, w.DD_VIEW.sugIdx || 0);
    const urgent = E.urgentList(foods);
    const expired = foods.filter(f => E.tier(f) === 'b');
    const fam = st.family;

    const hour = new Date(E.now()).getHours();
    const greet = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

    // 筛选
    const filter = w.DD_VIEW.filter || 'all';
    const catChips = ['all', 'p', 'b', '蔬菜', '肉类', '蛋奶', '水果', '主食', '豆制品'];
    let list = foods.slice();
    if (filter === 'p') list = list.filter(f => E.tier(f) === 'p');
    else if (filter === 'b') list = list.filter(f => E.tier(f) === 'b');
    else if (filter !== 'all') list = list.filter(f => f.cat === filter);
    const order = { p: 0, y: 1, g: 2, b: 3 };
    list.sort((a, b) => (order[E.tier(a)] - order[E.tier(b)]) || (E.daysLeft(a) - E.daysLeft(b)));

    const warnHtml =
      (urgent.length ? `<div class="alert">
           <span class="ic">🟣</span>
           <div class="txt">今天必须吃掉：<b>${urgent.slice(0, 3).map(f => esc(f.name)).join(' · ')}</b></div>
           <button class="go" data-action="genMenu">临期菜单 ›</button>
         </div>` : '') +
      (expired.length ? `<div class="alert bad">
           <span class="ic">⚫</span>
           <div class="txt"><b>${expired.length} 件</b>已过期，禁止食用</div>
           <button class="go" data-action="cleanExpired">清理 ›</button>
         </div>` : '') +
      (!urgent.length && !expired.length ? `<div class="alert ok">
           <span class="ic">🟢</span>
           <div class="txt">冰箱状态很好，没有临期食材</div>
           <button class="go" data-action="shoot">拍照入库 ›</button>
         </div>` : '');

    const aiHtml = sug ? `
      <div class="ai">
        <div class="ai-top">
          <div class="ai-chip">✨ AI 营养对对碰</div>
          <button class="ai-refresh" data-action="swap">换一组 ↻</button>
        </div>
        <div class="ai-pair">
          <span class="ing-bub">${em(sug.a)}</span>${esc(sug.a)}
          <span class="plus">＋</span>
          <span class="ing-bub">${em(sug.b)}</span>${esc(sug.b)}
        </div>
        <div class="ai-sub">${esc(sug.title)} · ${sug.dish ? '两样冰箱里都有' : '建议今天先处理'}</div>
        <div class="ai-tags">
          <span class="ai-tag">${sug.type === 'fallback' ? '🟣 临期优先' : '✔ 相生搭配'}</span>
          ${sug.dish ? '<span class="ai-tag">⏱ ' + D.DISHES.filter(d => d.id === sug.dish)[0].minutes + ' 分钟</span>' : ''}
          <span class="ai-tag">🔥 先吃快坏的</span>
        </div>
        <button class="ai-go" ${sug.dish ? 'data-dish="' + sug.dish + '"' : 'data-action="genMenu"'}>看教程 →</button>
      </div>` : '';

    return {
      title: '冰箱对对碰',
      tab: 'fridge',
      html: `
      <section class="hero">
        <div class="hero-top">
          <div>
            <div class="eyebrow">${greet} · ${E.dateLabel(E.now())}</div>
            <h1>${esc(fam.name)}的冰箱</h1>
            <div class="hero-sub">共 ${foods.length} 件食材${c.p ? ' · <b>' + c.p + ' 件临期待处理</b>' : ' · 状态良好'}</div>
          </div>
          <div class="family-chip">👨‍👩‍👧 ${fam.members.length} 人</div>
        </div>

        <div class="hero-body">
          <div class="donut">
            ${donutSvg(c, foods.length)}
            <div class="donut-c"><b>${foods.length}</b><span>件食材</span></div>
          </div>
          <div class="legend">
            <div class="lg g"><i style="background:#22C55E"></i><span>充足</span><b>${c.g}</b></div>
            <div class="lg y"><i style="background:#E9A50B"></i><span>正常</span><b>${c.y}</b></div>
            <div class="lg p"><i style="background:#8B5CF6"></i><span>临期</span><b>${c.p}</b></div>
            <div class="lg b"><i style="background:#525A6B"></i><span>过期</span><b>${c.b}</b></div>
          </div>
        </div>

        ${warnHtml}
      </section>

      ${aiHtml}

      <div class="chips">
        ${catChips.map(k => {
          const lab = k === 'all' ? '全部' : k === 'p' ? '🟣 临期' : k === 'b' ? '⚫ 过期' : k;
          const n = k === 'all' ? foods.length : k === 'p' ? c.p : k === 'b' ? c.b : foods.filter(f => f.cat === k).length;
          return `<button class="chip ${filter === k ? 'on' : ''}" data-filter="${k}">${lab}${n ? ' ' + n : ''}</button>`;
        }).join('')}
      </div>

      <div class="grid">
        ${list.length ? list.map(foodCard).join('') : `<div class="empty" style="grid-column:1/-1">
          <div class="e">🧺</div><div class="t">这里空空的</div>
          <div class="d">点下方中间的相机按钮，拍一张照就能自动入库</div></div>`}
      </div>

      <div class="section-head"><div class="t">四色怎么分</div></div>
      <div class="panel" style="margin-top:9px">
        <div class="p-body" style="margin-top:0">
          <b>🟢 剩余 ≥6 天</b> 安心存放 · <b>🟡 3~5 天</b> 常规轮换 ·
          <b>🟣 1~2 天</b> 必须优先吃 · <b>⚫ 已过期</b> 禁止食用。颜色随日期自动变化。
        </div>
      </div>
      `
    };
  }

  /* ---------------- 菜谱 ---------------- */
  function viewRecipe() {
    const st = S.state, foods = st.foods;
    const tab = w.DD_VIEW.recTab || 'fit';
    const q = (w.DD_VIEW.q || '').trim();

    let tabs = `<div class="chips" style="padding-top:10px">
      <button class="chip ${tab === 'fit' ? 'on' : ''}" data-tabrec="fit">用我的食材做</button>
      <button class="chip ${tab === 'all' ? 'on' : ''}" data-tabrec="all">全部菜谱</button>
      <button class="chip ${tab === 'pair' ? 'on' : ''}" data-tabrec="pair">相生相克</button>
    </div>`;

    let body = '';

    if (tab === 'fit') {
      const can = E.cookable(foods).sort((a, b) => E.dishScore(b, foods) - E.dishScore(a, foods));
      const near = E.nearMiss(foods).slice(0, 3);
      body += `<div class="section-head"><div class="t">现在就能做<small>${can.length} 道</small></div></div>`;
      body += can.length ? can.map(d => dishRow(d, true)).join('') : `<div class="empty"><div class="e">🥲</div>
        <div class="t">暂时凑不齐一道菜</div><div class="d">去冰箱看看还差什么，或点上方"全部菜谱"</div></div>`;
      if (near.length) {
        body += `<div class="section-head"><div class="t">只差 1 样<small>补货就能做</small></div></div>`;
        body += near.map(n => dishRow(n.dish, false, '还差 ' + n.need.emoji + ' ' + n.need.name)).join('');
      }
    } else if (tab === 'all') {
      let list = D.DISHES.slice();
      if (q) list = list.filter(d => d.name.indexOf(q) >= 0 || d.ingredients.some(i => i.name.indexOf(q) >= 0));
      body += `<div class="searchbar">
        <span style="font-size:13px">🔍</span>
        <input id="dishSearch" placeholder="搜菜名或食材，如：番茄" value="${esc(q)}">
      </div>`;
      body += list.length ? list.map(d => dishRow(d, false)).join('')
        : `<div class="empty"><div class="e">🔍</div><div class="t">没找到相关菜谱</div></div>`;
    } else {
      const pairs = E.pairList(foods, false);
      const present = pairs.filter(p => p.present);
      const other = pairs.filter(p => !p.present);
      body += `<div class="section-head"><div class="t">你冰箱里正在发生的<small>${present.length} 组</small></div></div>`;
      body += present.length ? present.map(pairCard).join('')
        : `<div class="empty"><div class="e">🧩</div><div class="t">暂未匹配到组合</div></div>`;
      body += `<div class="section-head"><div class="t">营养小百科<small>常见搭配</small></div></div>`;
      body += other.map(pairCard).join('');
    }

    return { title: '菜谱', tab: 'recipe', html: tabs + body };
  }

  function dishRow(d, hot, missing) {
    return `<button class="dish" data-dish="${d.id}">
      <div class="em">${d.emoji}</div>
      <div class="bd">
        <div class="nm">${esc(d.name)}${hot ? '<span class="hot">可做</span>' : ''}</div>
        <div class="ds">${d.ingredients.map(i => esc(i.name)).join(' + ')}${missing ? ' · <b style="color:#C2410C">' + esc(missing) + '</b>' : ''}</div>
        <div class="mt"><span>⏱ ${d.minutes} 分钟</span><span>${d.level}</span><span>${d.tags[0]}</span></div>
      </div>
      <div class="go">›</div>
    </button>`;
  }

  function pairCard(p) {
    const cls = p.type === 'syn' ? 'syn' : p.type === 'con' ? 'con' : 'cau';
    const lab = p.type === 'syn' ? '相生' : p.type === 'con' ? '相克' : '需处理';
    return `<div class="paircard">
      <div class="hd"><span>${em(p.a)} ${esc(p.a)} ＋ ${em(p.b)} ${esc(p.b)}</span>
        <span class="tp ${cls}">${lab}</span>
        ${p.present ? '<span class="tp syn">冰箱里有</span>' : '<span class="tp cau">未入库</span>'}
      </div>
      <div class="dc">${esc(p.desc)}</div>
      ${p.dish ? `<div class="hh">→ 推荐做法：${esc(D.DISHES.filter(d => d.id === p.dish)[0].name)}</div>` : ''}
    </div>`;
  }

  /* ---------------- 菜谱详情 ---------------- */
  function viewDish(id) {
    const d = D.DISHES.filter(x => x.id === id)[0];
    if (!d) return viewFridge();
    const st = S.state;
    const states = E.ingredientState(d, st.foods);
    const canCook = states.every(s => s.ok);

    return {
      title: d.name, back: true, tab: 'recipe',
      html: `
      <div class="subhead">
        <div class="em">${d.emoji}</div>
        <div><h2>${esc(d.name)}</h2>
          <div class="meta">⏱ ${d.minutes} 分钟 · ${d.level} · ${d.tags.join(' / ')}</div></div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>食材用量（2~3 人份）</h3>
        <div class="p-body" style="padding:0">
          ${states.map(s => `<div class="ing">
            <div class="l">${s.emoji} ${esc(s.name)}</div>
            <div class="q">${E.fmtQty(s.qty)} ${esc(s.unit)}
              <span class="${s.ok ? 'ok' : 'no'}">${s.ok ? '库存够' : (s.expired ? '已过期' : s.have ? '不够了' : '未入库')}</span>
            </div>
          </div>`).join('')}
        </div>
        <div class="taglist">${d.seasonings.map(s => `<span class="tg">${esc(s)}</span>`).join('')}</div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>预处理</h3>
        <div class="p-body" style="padding:0">
          ${d.prep.map((p, i) => `<div class="stepline" style="border-bottom:0;padding:7px 0">
            <div class="no ghost">${i + 1}</div>
            <div class="body"><p>${esc(p)}</p></div></div>`).join('')}
        </div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>分步做法</h3>
        <div class="p-body" style="padding:0">
          ${d.steps.map((s, i) => `<div class="stepline">
            <div class="no">${i + 1}</div>
            <div class="body">${s.heat !== '无火' && s.heat !== '关火' ? `<span class="heat">${s.heat}</span>` : ''}
              <p>${esc(s.text)}</p></div>
          </div>`).join('')}
        </div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>小贴士</h3>
        <div class="p-body">${d.tips.map(t => '💡 ' + esc(t)).join('<br>')}</div>
      </div>

      <div class="panel" style="background:linear-gradient(120deg,#F7F2FF,#FDF4FF);box-shadow:none;border:1px solid #EBDFFE">
        <h3><span class="dot" style="background:#8B5CF6"></span>营养说明</h3>
        <div class="p-body">${esc(d.nutrition)}<br><b style="color:#6D28D9">${esc(d.pair)}</b></div>
      </div>

      <div class="btn-row">
        <button class="btn ghost" data-action="shoot">📷 补拍食材</button>
        <button class="btn primary" data-cook="${d.id}">${canCook ? '开始做菜 · 更新库存' : '缺料，先去补购'}</button>
      </div>
      <div style="height:6px"></div>
      `
    };
  }

  /* ---------------- 食材详情 ---------------- */
  function viewFood(id) {
    const f = S.get(id);
    if (!f) return viewFridge();
    const t = E.tier(f);
    const d = E.daysLeft(f);
    const m = E.foodMeta(f.name);
    const related = D.DISHES.filter(x => x.ingredients.some(i => i.name === f.name)).slice(0, 3);
    const tipMap = {
      g: '状态很好，继续安心存放。注意别压在冰箱最里层被忘记。',
      y: '还新鲜，建议这周内安排吃掉，别拖到临期。',
      p: '高度临期！今天就该吃掉它。AI 已经为你优先推荐了相关菜谱。',
      b: '已过期，禁止食用。请直接丢弃并清理，避免污染其他食材。'
    };

    return {
      title: f.name, back: true, tab: 'fridge',
      html: `
      <div class="subhead">
        <div class="em">${f.emoji || m.emoji}</div>
        <div><h2>${esc(f.name)}</h2>
          <div class="meta">${esc(f.cat)} · ${esc(f.storage)}储存 · 入库 ${E.dateLabel(f.addedAt)}</div></div>
      </div>

      <div class="kv">
        <div class="k"><div class="lab">剩余数量</div><div class="val">${E.fmtQty(f.qty)} ${esc(f.unit)}</div></div>
        <div class="k"><div class="lab">状态</div><div class="val" style="color:${E.TIERS[t].color}">${E.TIERS[t].emoji} ${E.TIERS[t].label}</div></div>
        <div class="k"><div class="lab">${d > 0 ? '还能放' : '已过期'}</div><div class="val" style="color:${E.TIERS[t].color}">${E.dayText(f)}</div></div>
      </div>

      <div class="panel" style="border-left:4px solid ${E.TIERS[t].color}">
        <h3><span class="dot" style="background:${E.TIERS[t].color}"></span>${E.TIERS[t].hint}</h3>
        <div class="p-body">${tipMap[t]}</div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>库存信息</h3>
        <div class="p-body">
          标准保质期 ${esc(String(f.shelfDays || m.shelf))} 天 · 建议储存：${esc(f.storage)}<br>
          到期日 ${E.dateLabel(f.expireAt)}（${E.dayText(f)}）<br>
          参考单价 ¥${m.price}/${esc(m.unit)}，当前价值约 ¥${(E.fmtQty(f.qty * m.price))}
        </div>
      </div>

      ${related.length ? `<div class="section-head"><div class="t">用它能做</div></div>
        ${related.map(x => dishRow(x, false)).join('')}` : ''}

      <div class="btn-row">
        <button class="btn ghost" data-action="eat" data-id="${f.id}">吃掉一部分</button>
        <button class="btn ghost" data-action="repic" data-id="${f.id}">📷 拍剩余量</button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        ${t === 'b'
          ? `<button class="btn soft" data-action="trash" data-id="${f.id}">🗑 已丢弃 / 清理</button>`
          : `<button class="btn soft" data-action="eatAll" data-id="${f.id}">✅ 吃完了</button>
             <button class="btn soft" data-action="trash" data-id="${f.id}">🗑 已丢弃</button>`}
      </div>
      <div style="height:6px"></div>
      `
    };
  }

  /* ---------------- 一周配餐 ---------------- */
  function viewWeek() {
    const st = S.state;
    const week = st.week;
    if (!week) return { title: '一周配餐', tab: 'plan', back: true, html: '<div class="empty"><div class="e">🍽</div><div class="t">还没有生成</div></div>' };
    const used = {};
    week.forEach(d => Object.keys(d.meals).forEach(k => {
      const id = d.meals[k].id;
      used[id] = (used[id] || 0) + 1;
    }));
    const total = Object.keys(used).length;

    return {
      title: '一周配餐', tab: 'plan', back: true,
      html: `
      <div class="panel" style="background:linear-gradient(120deg,#FFF7F0,#FFFDFB);border:1px solid #FBEADF;box-shadow:none">
        <h3><span class="dot"></span>为你家生成的 7 天菜单</h3>
        <div class="p-body">
          兼顾 ${st.family.members.map(m => m.role).join(' / ')} 的饮食需求，
          <b>临期食材排在周一、周二优先消耗</b>；同一道菜一周内尽量不重复。
        </div>
        <div class="statmini" style="grid-template-columns:repeat(3,1fr)">
          <div class="s"><div class="v">${total}</div><div class="l">道菜不重样</div></div>
          <div class="s"><div class="v">${E.counts(st.foods).p}</div><div class="l">临期食材待用</div></div>
          <div class="s"><div class="v">7</div><div class="l">天全覆盖</div></div>
        </div>
      </div>

      ${week.map(day => `
        <div class="weekday">
          <div class="wh"><div class="d">${esc(day.label)}<small>${esc(day.date)}</small></div>
            ${day.notes.length ? `<div class="n">${day.notes.map(n => '· ' + n).join(' ')}</div>` : ''}
          </div>
          ${['早', '午', '晚'].map(slot => {
            const m = day.meals[slot];
            if (!m) return '';
            const dd = D.DISHES.filter(x => x.id === m.id)[0];
            return `<button class="meal" data-dish="${dd.id}">
              <span class="slot">${slot}</span>
              <span class="em">${dd.emoji}</span>
              <span class="nm">${esc(dd.name)}${m.missing ? ' <small style="color:#C2410C">(需补料)</small>' : ''}</span>
              ${!m.missing && dd.ingredients.some(i => { const f = E.findFood(st.foods, i.name); return f && E.tier(f) === 'p'; }) ? '<span class="flag">临期</span>' : ''}
            </button>`;
          }).join('')}
        </div>`).join('')}

      <div class="btn-row">
        <button class="btn ghost" data-action="genWeek">🔄 重新生成</button>
        <button class="btn primary" data-nav="plan">配餐总览</button>
      </div>
      <div style="height:6px"></div>
      `
    };
  }

  /* ---------------- 配餐入口 ---------------- */
  function viewPlan() {
    const st = S.state;
    const fam = st.family;
    const cart = st.cart || [];
    const cartSum = cart.reduce((s, c) => s + c.qty * (c.price || 0), 0);

    return {
      title: '配餐', tab: 'plan',
      html: `
      <div class="hello"><div>
        <h1>一周配餐</h1>
        <p>按全家年龄结构和冰箱现状自动排菜</p>
      </div></div>

      <div class="panel" style="margin-top:12px">
        <div class="row between">
          <h3><span class="dot"></span>家庭档案</h3>
          <button class="chip" style="padding:5px 10px;font-size:10px" data-action="editFamily">编辑</button>
        </div>
        <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap">
          ${fam.members.map(m => `<span class="tg" style="font-size:10px;padding:4px 8px">${
            m.role === '幼儿' ? '👶' : m.role === '老人' ? '👵' : '👨'
          } ${esc(m.role)} ${m.age} 岁</span>`).join('')}
        </div>
        ${fam.taboos ? `<div class="tiny muted" style="margin-top:8px">忌口：${esc(fam.taboos)}</div>` : ''}
      </div>

      <div class="ai" style="background:linear-gradient(125deg,#7C5CE0,#5B8DEF 60%,#33C3C0)">
        <div class="ai-top"><div class="ai-chip">🧠 AI 个性化配餐</div><div class="ai-refresh">7 天</div></div>
        <div class="ai-pair" style="font-size:15px">生成一周不重样营养食谱</div>
        <div class="ai-sub" style="padding-right:100px">幼儿少盐 · 老人补钙 · 先吃临期</div>
        <button class="ai-go" data-action="genWeek" style="color:#5B8DEF">立即生成 →</button>
      </div>

      ${st.week ? `<button class="dish" data-week="1" style="margin-top:10px">
        <div class="em" style="background:linear-gradient(140deg,#F7F2FF,#EDE4FF)">📅</div>
        <div class="bd"><div class="nm">本周菜单已生成</div>
          <div class="ds">点击查看 7 天 × 三餐，支持重新生成</div></div>
        <div class="go">›</div>
      </button>` : ''}

      <div class="section-head"><div class="t">配餐依据</div></div>
      <div class="panel" style="margin-top:9px;padding:7px 14px">
        ${fam.members.map(m => {
          const ic = m.role === '幼儿' ? '👶' : m.role === '老人' ? '👵' : '👨';
          const rule = m.role === '老人' ? '补钙 · 少盐 · 炖软烂'
            : m.role === '幼儿' ? '少盐 · 切小块 · 易嚼'
            : '控油 · 多蔬菜 · 控糖';
          return `<div class="ing">
            <div class="l">${ic} ${esc(m.role)} ${m.age} 岁</div>
            <div class="q">${rule}</div>
          </div>`;
        }).join('')}
      </div>

      <div class="section-head"><div class="t">周末家庭聚餐</div></div>
      <div class="panel" style="margin-top:9px">
        <h3><span class="dot"></span>一键排一桌菜</h3>
        <div class="p-body">AI 盘点冰箱现有食材 → 自动搭配一桌菜 + 全套教程 → 算出缺什么、买多少。</div>
        <div class="btn-row" style="margin-top:11px">
          <button class="btn primary sm" data-action="openParty">🍲 开启聚餐规划</button>
        </div>
      </div>

      <div class="section-head"><div class="t">采购清单<small>${cart.length} 项</small></div>
        ${cart.length ? '<button class="more" data-action="cartClear">清空</button>' : ''}</div>
      <div class="panel" style="margin-top:8px">
        ${cart.length ? cart.map(c => `<div class="cart-item">
          <span class="em">${c.emoji}</span>
          <span class="nm">${esc(c.name)}</span>
          <span class="q">${E.fmtQty(c.qty)} ${esc(c.unit)}</span>
        </div>`).join('') + `
        <div class="row between" style="margin-top:10px">
          <div class="small muted">预估 ¥${cartSum.toFixed(1)}</div>
          <button class="btn primary sm" style="flex:none;padding:0 14px" data-action="cartBuy">已购入库</button>
        </div>`
        : `<div class="p-body" style="margin-top:0">还没有采购项。在聚餐规划里生成缺料清单，或直接从菜谱补货。</div>`}
      </div>
      <div style="height:10px"></div>
      `
    };
  }

  /* ---------------- 聚餐 ---------------- */
  function viewParty() {
    const st = S.state;
    const p = st.party;
    if (!p) {
      return {
        title: '家庭聚餐', tab: 'plan', back: true,
        html: `
        <div class="panel">
          <h3><span class="dot"></span>几个人吃？</h3>
          <div class="p-body">人数会影响菜量和采购量，AI 会按人均 1.2 道菜搭配。</div>
          <div class="chips" style="padding:10px 0 0">
            ${[2, 3, 4, 5, 6, 8, 10].map(n => `<button class="chip ${(w.DD_VIEW.people || 4) === n ? 'on' : ''}" data-people="${n}">${n} 人</button>`).join('')}
          </div>
          <div class="btn-row"><button class="btn primary" data-action="genParty">开始规划这桌菜</button></div>
        </div>`
      };
    }

    const totalCost = p.missing.reduce((s, m) => s + (m.cost || 0), 0);
    return {
      title: '聚餐方案', tab: 'plan', back: true,
      html: `
      <div class="panel" style="background:linear-gradient(120deg,#FFF7F0,#FFFDFB);border:1px solid #FBEADF;box-shadow:none">
        <h3><span class="dot"></span>${p.people} 人 · ${p.dishes.length} 道菜</h3>
        <div class="p-body">已盘点冰箱全部食材，这桌菜主要靠现有库存，只有 <b>${p.missing.length}</b> 样需要补购。</div>
      </div>

      <div class="section-head"><div class="t">菜单<small>点开看教程</small></div></div>
      ${p.dishes.map(d => dishRow(d, E.ingredientState(d, st.foods).every(s => s.ok))).join('')}

      <div class="section-head"><div class="t">需要补购<small>${p.missing.length} 样</small></div></div>
      <div class="panel" style="margin-top:8px">
        ${p.missing.length ? p.missing.map(m => `<div class="cart-item">
          <span class="em">${m.emoji}</span>
          <span class="nm">${esc(m.name)}</span>
          <span class="q">${E.fmtQty(m.qty)} ${esc(m.unit)} · ¥${(m.cost || 0).toFixed(1)}</span>
        </div>`).join('') + `
        <div class="row between" style="margin-top:10px">
          <div class="small muted">合计约 ¥${totalCost.toFixed(1)}</div>
          <button class="btn primary sm" style="flex:none;padding:0 12px" data-action="cartAdd">加入采购清单</button>
        </div>`
        : `<div class="p-body" style="margin-top:0">🎉 冰箱里样样都有，不用买任何东西。</div>`}
      </div>
      <div class="btn-row"><button class="btn ghost" data-action="openParty">换个规模重排</button></div>
      <div style="height:8px"></div>
      `
    };
  }

  /* ---------------- 我的 ---------------- */
  function viewMe() {
    const st = S.state;
    const sum = E.summary(st);
    const cart = st.cart || [];
    const off = st.clockOffset || 0;

    return {
      title: '我的', tab: 'me',
      html: `
      <div class="hello"><div>
        <h1>${esc(st.family.name)}的厨房</h1>
        <p>使用第 ${Math.max(1, Math.ceil((E.now() - st.createdAt) / 86400000))} 天 · 冰箱 ${sum.total} 件</p>
      </div></div>

      <div class="statmini">
        <div class="s"><div class="v">${sum.cooked}</div><div class="l">已做菜（顿）</div></div>
        <div class="s"><div class="v" style="color:#16A34A">¥${sum.saved.toFixed(0)}</div><div class="l">挽回浪费</div></div>
        <div class="s"><div class="v">${st.stats.trashed || 0}</div><div class="l">清理过期</div></div>
      </div>

      <div class="section-head"><div class="t">四色保质期规则</div></div>
      <div class="panel" style="margin-top:8px;padding:6px 13px">
        ${['g', 'y', 'p', 'b'].map(k => `<div class="ing">
          <div class="l"><span style="font-size:12px">${E.TIERS[k].emoji}</span>
            <span style="font-weight:700">${E.TIERS[k].label}</span>
            <span class="q">${k === 'g' ? '剩余 ≥ 6 天' : k === 'y' ? '剩余 3~5 天' : k === 'p' ? '剩余 1~2 天' : '已过期'}</span>
          </div>
          <div class="q">${E.TIERS[k].hint}</div>
        </div>`).join('')}
      </div>

      <div class="section-head"><div class="t">演示工具<small>答辩时可现场演示</small></div></div>
      <div class="panel" style="margin-top:8px">
        <h3><span class="dot"></span>时间旅行</h3>
        <div class="p-body">时间当前偏移 <b>${off > 0 ? '+' : ''}${Math.round(off / 86400000)} 天</b>。
          推进几天，能看到食材颜色实时变成黄 / 紫 / 黑——这正是四色系统的核心。</div>
        <div class="chips" style="padding:8px 0 0">
          <button class="chip" data-action="travel" data-days="1">+1 天</button>
          <button class="chip" data-action="travel" data-days="3">+3 天</button>
          <button class="chip" data-action="travel" data-days="7">+7 天</button>
          ${off ? '<button class="chip" data-action="travel" data-days="' + (-Math.round(off / 86400000)) + '">回到今天</button>' : ''}
        </div>
      </div>

      <div class="section-head"><div class="t">采购清单<small>${cart.length} 项</small></div></div>
      <div class="panel" style="margin-top:8px">
        ${cart.length ? cart.map(c => `<div class="cart-item"><span class="em">${c.emoji}</span>
          <span class="nm">${esc(c.name)}</span><span class="q">${E.fmtQty(c.qty)} ${esc(c.unit)}</span></div>`).join('') +
          `<div class="btn-row"><button class="btn primary sm" data-action="cartBuy">已购入库</button></div>`
          : `<div class="p-body" style="margin-top:0">清单是空的。</div>`}
      </div>

      <div class="section-head"><div class="t">数据</div></div>
      <div class="panel" style="margin-top:8px">
        <div class="p-body" style="margin-top:0">所有数据存在本机浏览器（localStorage），不会上传。刷新或关闭后仍在。</div>
        <div class="btn-row"><button class="btn soft" data-action="reset">恢复示例数据</button></div>
      </div>
      <div style="height:10px"></div>
      `
    };
  }

  /* ---------------- 入口 ---------------- */
  function render(view) {
    switch (view.name) {
      case 'fridge': return viewFridge();
      case 'recipe': return viewRecipe();
      case 'plan': return viewPlan();
      case 'me': return viewMe();
      case 'dish': return viewDish(view.id);
      case 'food': return viewFood(view.id);
      case 'week': return viewWeek();
      case 'party': return viewParty();
      default: return viewFridge();
    }
  }

  w.DD_UI = { render, esc, foodCard, dishRow };
})(window);
