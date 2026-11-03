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
  function fmtSec(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  /* 菜系分区（按主菜系归类，每道菜只出现一次） */
  const GROUP_ORDER = ['家常', '川菜', '粤菜', '江浙', '鲁菜', '湘菜', '东北', '西北', '西餐', '日韩', '东南亚', '清淡'];
  const GROUP_LABEL = {
    家常: '家常菜', 川菜: '川菜 · 麻辣', 粤菜: '粤菜 · 清鲜', 江浙: '江浙 · 甜鲜',
    鲁菜: '鲁菜 · 咸鲜', 湘菜: '湘菜 · 香辣', 东北: '东北菜', 西北: '西北菜',
    西餐: '西餐 · 意法英美', 日韩: '日韩料理', 东南亚: '东南亚 · 咖喱', 清淡: '清淡 · 汤羹'
  };

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
  let GID = 0;
  function donutSvg(c, total) {
    const R = 40, C = 2 * Math.PI * R;
    const uid = 'd' + (++GID);
    const defs = `<defs>
      <linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ADE80"/><stop offset="1" stop-color="#15A34A"/></linearGradient>
      <linearGradient id="${uid}y" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD24D"/><stop offset="1" stop-color="#DE9A05"/></linearGradient>
      <linearGradient id="${uid}p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B79BFF"/><stop offset="1" stop-color="#7C3AED"/></linearGradient>
      <linearGradient id="${uid}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#808894"/><stop offset="1" stop-color="#3F4653"/></linearGradient>
    </defs>`;
    if (!total) {
      return `<svg viewBox="0 0 100 100">${defs}<circle cx="50" cy="50" r="${R}" fill="none" stroke="#F0EBE4" stroke-width="11"/></svg>`;
    }
    const order = [['g', `url(#${uid}g)`], ['y', `url(#${uid}y)`], ['p', `url(#${uid}p)`], ['b', `url(#${uid}b)`]];
    let acc = 0, arcs = '';
    order.forEach(function (it) {
      const n = c[it[0]] || 0;
      if (!n) return;
      const len = n / total * C;
      const dash = Math.max(len - 5, 2);
      arcs += `<circle class="donut-arc" cx="50" cy="50" r="${R}" fill="none" stroke="${it[1]}"
        stroke-width="11" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}"
        stroke-dashoffset="${(-acc).toFixed(2)}"/>`;
      acc += len;
    });
    return `<svg viewBox="0 0 100 100">${defs}
      <circle cx="50" cy="50" r="${R}" fill="none" stroke="#F1ECE4" stroke-width="11"/>
      <g class="donut-arcs">${arcs}</g></svg>`;
  }

  /* ---------------- 营养雷达图 ---------------- */
  function radarSvg(bars) {
    const cx = 62, cy = 62, R = 44, n = bars.length;
    const uid = 'r' + (++GID);
    const pt = function (i, ratio) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [cx + Math.cos(a) * R * ratio, cy + Math.sin(a) * R * ratio];
    };
    const ring = function (k) {
      const pts = bars.map(function (_, i) { return pt(i, k).map(v => v.toFixed(1)).join(','); }).join(' ');
      return `<polygon points="${pts}" fill="none"
        stroke="${k === 1 ? '#E3D8C8' : '#F0EAE0'}" stroke-width="${k === 1 ? 1.4 : 1}"
        ${k === 1 ? 'stroke-dasharray="3 3"' : ''}/>`;
    };
    const grid = [0.25, 0.5, 0.75, 1].map(ring).join('');
    const spokes = bars.map(function (_, i) {
      const p = pt(i, 1);
      return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#F0EAE0" stroke-width="1"/>`;
    }).join('');
    const shape = bars.map(function (b, i) {
      return pt(i, Math.min(100, Math.max(5, b.pct)) / 100).map(v => v.toFixed(1)).join(',');
    }).join(' ');
    const dots = bars.map(function (b, i) {
      const p = pt(i, Math.min(100, Math.max(5, b.pct)) / 100);
      return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="#fff" stroke="#FF6B3D" stroke-width="1.8"/>`;
    }).join('');
    const labels = bars.map(function (b, i) {
      const p = pt(i, 1.3);
      const good = b.pct >= 90;
      return `<text x="${p[0].toFixed(1)}" y="${(p[1] + 3).toFixed(1)}" font-size="7.5"
        fill="${good ? '#127A45' : '#9AA0AC'}" text-anchor="middle" font-weight="700">${b.short || b.label}</text>`;
    }).join('');
    return `<svg viewBox="0 0 124 124" class="radar">
      <defs>
        <radialGradient id="${uid}f" cx="50%" cy="45%" r="60%">
          <stop offset="0" stop-color="#FF9A6B" stop-opacity=".55"/>
          <stop offset="1" stop-color="#FF6B3D" stop-opacity=".12"/>
        </radialGradient>
      </defs>
      ${grid}${spokes}
      <polygon class="radar-shape" points="${shape}" fill="url(#${uid}f)"
        stroke="#FF6B3D" stroke-width="2" stroke-linejoin="round"/>
      ${dots}${labels}</svg>`;
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

    // 筛选（分类 + 冰箱分区）
    const filter = w.DD_VIEW.filter || 'all';
    const catChips = ['all', 'p', 'b', '蔬菜', '肉类', '水产', '蛋奶', '豆制品', '水果', '主食', '调味', '零食', 'z:冷藏', 'z:冷冻', 'z:常温'];
    let list = foods.slice();
    if (filter === 'p') list = list.filter(f => E.tier(f) === 'p');
    else if (filter === 'b') list = list.filter(f => E.tier(f) === 'b');
    else if (filter.indexOf('z:') === 0) {
      const z = filter.slice(2);
      list = list.filter(f => (f.storage || '冷藏') === z);
    }
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

    const today = E.todayMenu(st);
    const todayHtml = (today && today.length)
      ? `<div class="panel" style="margin-top:9px;padding:6px 14px">
          ${today.map(function (t) {
            const m = t.ids && t.ids.length ? t.ids : [t.dish.id];
            const ds = m.map(id => D.DISHES.filter(x => x.id === id)[0]).filter(Boolean);
            return `<div class="meal">
              <span class="slot">${t.slot}</span>
              <div class="meal-dishes">
                ${ds.map(dd => `<span class="mname" data-dish="${dd.id}">${dd.emoji} ${esc(dd.name)}</span>`).join('<span class="sep">·</span>')}
              </div>
              ${t.missing ? '<span class="flag" style="background:#FEE2E2;color:#B91C1C">补料</span>' : ''}
            </div>`;
          }).join('')}
        </div>`
      : `<div class="panel" style="margin-top:9px">
          <div class="p-body" style="margin-top:0">还没排今天的菜。按家庭档案生成一周菜单后，这里会显示早 / 午 / 晚。</div>
          <div class="btn-row" style="margin-top:10px"><button class="btn primary sm" data-action="genWeek">生成今天的菜单</button></div>
        </div>`;

    const aiHtml = sug ? `      <div class="ai">
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
            <h1>${esc(fam.name || '我')}的冰箱</h1>
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

      <div class="section-head"><div class="t">今天的菜单<small>按家庭档案配好</small></div>
        <button class="more" data-nav="plan">换一换 ›</button></div>
      ${todayHtml}

      <div class="chips">
        ${catChips.map(k => {
          let lab, n;
          if (k === 'all') { lab = '全部'; n = foods.length; }
          else if (k === 'p') { lab = '🟣 临期'; n = c.p; }
          else if (k === 'b') { lab = '⚫ 过期'; n = c.b; }
          else if (k.indexOf('z:') === 0) {
            const z = k.slice(2); lab = z; n = foods.filter(f => (f.storage || '冷藏') === z).length;
          } else { lab = k; n = foods.filter(f => f.cat === k).length; }
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
      <button class="chip ${tab === 'video' ? 'on' : ''}" data-tabrec="video">视频做菜</button>
      <button class="chip ${tab === 'pair' ? 'on' : ''}" data-tabrec="pair">相生相克</button>
    </div>`;

    let body = '';
    const pinnedIds = S.state.pinned || [];
    const pinnedDishes = pinnedIds.map(id => D.DISHES.filter(d => d.id === id)[0]).filter(Boolean);
    const showPinned = (tab === 'fit' || tab === 'all') && pinnedDishes.length;
    const pinnedHtml = showPinned ? `
      <div class="section-head"><div class="t">我的置顶<small>${pinnedDishes.length} 道</small></div>
        <button class="more" data-action="clearPins">全部取消</button></div>
      ${pinnedDishes.map(d => dishRow(d, E.ingredientState(d, foods).every(s => s.ok))).join('')}` : '';

    if (tab === 'fit') {
      const can = E.cookable(foods)
        .filter(d => pinnedIds.indexOf(d.id) < 0)
        .sort((a, b) => E.dishScore(b, foods) - E.dishScore(a, foods));
      const near = E.nearMiss(foods).filter(n => pinnedIds.indexOf(n.dish.id) < 0).slice(0, 3);
      body += pinnedHtml;
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
      list = list.filter(d => pinnedIds.indexOf(d.id) < 0);
      body += pinnedHtml;
      body += `<div class="searchbar">
        <span style="font-size:13px">🔍</span>
        <input id="dishSearch" placeholder="搜菜名或食材，如：番茄" value="${esc(q)}">
      </div>`;
      body += list.length ? (function () {
        const buckets = {};
        list.forEach(function (d) {
          const k = (d.cuisine && d.cuisine[0]) || '家常';
          (buckets[k] = buckets[k] || []).push(d);
        });
        const keys = GROUP_ORDER.filter(k => buckets[k] && buckets[k].length)
          .concat(Object.keys(buckets).filter(k => GROUP_ORDER.indexOf(k) < 0));
        return keys.map(function (k) {
          return `<div class="section-head"><div class="t">${GROUP_LABEL[k] || k}<small>${buckets[k].length} 道</small></div></div>` +
            buckets[k].map(d => dishRow(d, false)).join('');
        }).join('');
      })()
        : `<div class="empty"><div class="e">🔍</div><div class="t">没找到相关菜谱</div></div>`;
    } else if (tab === 'video') {
      body = videoLibBody();
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

    const addRow = `<div class="row between" style="padding:10px 2px 0">
      <div class="tiny muted">共 ${D.DISHES.length} 道 · ${D.CUISINES.length} 个菜系</div>
      <button class="addchip" data-action="openAddDish">＋ 添加菜谱</button>
    </div>`;

    return { title: '菜谱', tab: 'recipe', html: tabs + addRow + body };
  }

  function dishRow(d, hot, missing) {
    const pinned = (S.state.pinned || []).indexOf(d.id) >= 0;
    return `<div class="dish${pinned ? ' pinned' : ''}" data-dish="${d.id}" role="button" tabindex="0">
      <div class="em">${d.emoji}</div>
      <div class="bd">
        <div class="nm">${esc(d.name)}${hot ? '<span class="hot">可做</span>' : ''}${pinned ? '<span class="hot pinmark">已置顶</span>' : ''}</div>
        <div class="ds">${d.ingredients.map(i => esc(i.name)).join(' + ')}${missing ? ' · <b style="color:#C2410C">' + esc(missing) + '</b>' : ''}</div>
        <div class="mt"><span>⏱ ${d.minutes} 分钟</span><span>${d.level}</span><span>${d.tags[0]}</span></div>
      </div>
      <button class="pin${pinned ? ' on' : ''}" data-pin="${d.id}" aria-label="置顶这道菜">📌</button>
      <div class="go">›</div>
    </div>`;
  }

  /* 置顶的排在前面 */
  function pinFirst(list) {
    const pins = S.state.pinned || [];
    return list.slice().sort(function (a, b) {
      return (pins.indexOf(b.id) >= 0 ? 1 : 0) - (pins.indexOf(a.id) >= 0 ? 1 : 0);
    });
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
    const allergens = E.allergensOf(d);
    const avoid = (st.family && st.family.avoid) || [];
    const conflict = allergens.filter(a => avoid.indexOf(a) >= 0);
    const allergenHtml = conflict.length
      ? `<div class="alert bad"><span class="ic">⚠️</span><div class="txt">含 <b>${conflict.join('、')}</b>，家里有人过敏，建议换一道</div></div>`
      : '';
    const nut = E.dishNutritionPerServing(d);
    const pinned = (S.state.pinned || []).indexOf(d.id) >= 0;
    const cost = d.ingredients.reduce(function (s, i) {
      return s + i.qty * (E.foodMeta(i.name).price || 0);
    }, 0);

    return {
      title: d.name, back: true, tab: 'recipe',
      html: `
      <div class="subhead">
        <div class="em">${d.emoji}</div>
        <div style="flex:1;min-width:0"><h2>${esc(d.name)}</h2>
          <div class="meta">⏱ ${d.minutes} 分钟 · ${d.level} · ${d.tags.join(' / ')}</div></div>
        <button class="pin big${pinned ? ' on' : ''}" data-pin="${d.id}" aria-label="置顶这道菜">📌</button>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>食材用量（2~3 人份）</h3>
        <div class="p-body" style="padding:0">
          ${states.map(function (s) {
            const subs = s.ok ? [] : E.substitutesFor(s.name);
            return `<div class="ing">
              <div class="l">${s.emoji} ${esc(s.name)}${subs.length ? `<em class="subhint">缺了可用 ${subs.join(' / ')}</em>` : ''}</div>
              <div class="q">${E.fmtQty(s.qty)} ${esc(s.unit)}
                <span class="${s.ok ? 'ok' : 'no'}">${s.ok ? '库存够' : (s.expired ? '已过期' : s.have ? '不够了' : '未入库')}</span>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="taglist">${d.seasonings.map(s => `<span class="tg">${esc(s)}</span>`).join('')}</div>
        ${allergens.length ? `<div class="taglist" style="margin-top:6px">${allergens.map(a => `<span class="tg" style="background:#FFF4E6;color:#B45309">含${esc(a)}</span>`).join('')}</div>` : ''}
        <div class="nutline">食材成本约 ¥${cost.toFixed(1)} · 按当日行情折算</div>
      </div>

      ${allergenHtml}

      <div class="panel">
        <h3><span class="dot"></span>预处理</h3>
        <div class="p-body" style="padding:0">
          ${d.prep.map((p, i) => `<div class="stepline" style="border-bottom:0;padding:7px 0">
            <div class="no ghost">${i + 1}</div>
            <div class="body"><p>${esc(p)}</p></div></div>`).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="row between">
          <h3><span class="dot"></span>分步做法</h3>
          <button class="tool" data-speakall="${d.id}">🔊 朗读全部</button>
        </div>
        <div class="p-body" style="padding:0">
          ${d.steps.map(function (s, i) {
            const mm = s.text.match(/(\d+(?:\.\d+)?)\s*分钟/);
            const ss = s.text.match(/(\d+)\s*秒/);
            const secs = mm ? Math.round(parseFloat(mm[1]) * 60) : (ss ? parseInt(ss[1], 10) : 0);
            return `<div class="stepline">
              <div class="no">${i + 1}</div>
              <div class="body">
                ${s.heat !== '无火' && s.heat !== '关火' ? `<span class="heat">${s.heat}</span>` : ''}
                <p>${esc(s.text)}</p>
                <div class="step-tools">
                  ${secs ? `<button class="tool" data-timer="${secs}">⏱ ${fmtSec(secs)}</button>` : ''}
                  <button class="tool" data-speak="${esc(s.text)}">🔊 朗读</button>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>小贴士</h3>
        <div class="p-body">${d.tips.map(t => '💡 ' + esc(t)).join('<br>')}</div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>视频对照</h3>
        ${d.videos.length
          ? d.videos.map(v => `<button class="vrow" data-play="${v.bvid}" data-title="${esc(v.title)}">
              <span class="vthumb">▶</span>
              <span class="vt"><b>${esc(v.title)}</b><small>哔哩哔哩 · 站内播放，可对着做</small></span>
            </button>`).join('')
          : `<div class="p-body" style="margin-top:2px">这道菜还没收录示范视频，可以直接去平台搜同款做法。</div>`}
        <div class="vplat">
          ${D.PLATFORMS.map(p => `<a class="vchip" href="${E.videoSearch(p.key, d.name)}" target="_blank" rel="noopener">${p.icon} 在${p.name}搜「${esc(d.name)}」</a>`).join('')}
        </div>
      </div>

      <div class="panel" style="background:linear-gradient(120deg,#F7F2FF,#FDF4FF);box-shadow:none;border:1px solid #EBDFFE">
        <h3><span class="dot" style="background:#8B5CF6"></span>营养说明</h3>
        <div class="p-body">${esc(d.nutrition)}<br><b style="color:#6D28D9">${esc(d.pair)}</b></div>
        <div class="nutline">
          每份约 ${nut.kcal} kcal · 蛋白 ${nut.p} g · 钙 ${nut.ca} mg · 铁 ${nut.fe} mg · 维C ${nut.vc} mg
        </div>
      </div>

      <div class="btn-row">
        <button class="btn ghost" data-action="shoot">📷 补拍食材</button>
        ${canCook
          ? `<button class="btn primary" data-cook="${d.id}">开始做菜 · 更新库存</button>`
          : `<button class="btn primary" data-action="cartAddDish" data-id="${d.id}">缺的加入采购清单</button>`}
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
          ${m.pricePerKg ? `<br><span class="tiny muted">行情 ¥${m.pricePerKg}/kg · ${esc(m.priceSource || '批发均价')}，零售按 1.6 倍折算</span>` : ''}
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
    const sys = D.SYSTEM_MAP[(week[0] && week[0].system) || 'cn'] || D.MEAL_SYSTEMS[0];

    const todayDishes = ['早', '午', '晚'].map(function (s) {
      const m = week[0].meals[s];
      return m ? D.DISHES.filter(d => d.id === m.id)[0] : null;
    }).filter(Boolean);
    const lunch = todayDishes[1] || todayDishes[0];
    const nutTotals = lunch ? E.mealNutrition(lunch) : { kcal: 0, p: 0, ca: 0, fe: 0, vc: 0 };
    const nutTarget = E.perMealTarget(st.family);
    const nutBars = E.nutritionBars(nutTotals, nutTarget);
    const nutriHtml = `
      <div class="panel">
        <h3><span class="dot"></span>这一餐的营养<small style="font-weight:600;color:#8B909C;margin-left:6px">${lunch ? lunch.name + ' + 1 碗饭' : '未排菜'}</small></h3>
        <div class="nutri">
          ${radarSvg(nutBars)}
          <div class="nutri-bars">
            ${nutBars.map(function (b) {
              const over = b.pct > 130;
              const good = b.pct >= 90 && b.pct <= 130;
              const near = b.pct >= 60 && b.pct < 90;
              const tag = over ? '偏高' : good ? '达标' : near ? '接近' : '偏低';
              const color = over ? '#E0A00B' : good ? '#16A34A' : near ? '#F0A020' : '#FF5C7A';
              return `<div class="nb">
                <div class="nb-top">
                  <span>${b.label}</span>
                  <span class="nb-r">
                    <i class="nb-tag" style="color:${color};background:${color}1A">${tag}</i>
                    <b>${b.got}<small>/${b.need}${b.unit}</small></b>
                  </span>
                </div>
                <div class="nb-bar"><i style="width:${Math.min(100, b.pct)}%;background:linear-gradient(90deg,${color}AA,${color})"></i></div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="tiny muted" style="margin-top:10px;line-height:1.6">
          按每人份一道菜 + 一碗饭估算，对照${(st.family.members || []).length} 位家人的每餐目标；数值为近似参考，不是医学建议。
        </div>
      </div>`;

    return {
      title: '一周配餐', tab: 'plan', back: true,
      html: `
      <div class="panel" style="background:linear-gradient(120deg,#FFF7F0,#FFFDFB);border:1px solid #FBEADF;box-shadow:none">
        <h3><span class="dot"></span>为你家生成的 7 天菜单</h3>
        <div class="p-body">
          <b>${sys.emoji} ${sys.name}</b>：${esc(sys.desc)}<br>
          <span class="tiny muted">${esc(sys.structure)}</span><br>
          兼顾 ${st.family.members.map(m => m.role).join(' / ')} 的饮食需求；
          <b>临期食材排在今天、明天优先消耗</b>。
        </div>
        <div class="statmini" style="grid-template-columns:repeat(3,1fr)">
          <div class="s"><div class="v">${total}</div><div class="l">道菜不重样</div></div>
          <div class="s"><div class="v">${E.counts(st.foods).p}</div><div class="l">临期食材待用</div></div>
          <div class="s"><div class="v">7</div><div class="l">天全覆盖</div></div>
        </div>
      </div>

      ${nutriHtml}

      ${week.map(day => `
        <div class="weekday">
          <div class="wh"><div class="d">${esc(day.label)}<small>${esc(day.date)}</small></div>
            ${day.notes.length ? `<div class="n">${day.notes.map(n => '· ' + n).join(' ')}</div>` : ''}
          </div>
          ${['早', '午', '晚'].map(function (slot) {
            const m = day.meals[slot];
            if (!m || !(m.ids || []).length) return '';
            const items = (m.ids || [m.id]).map(id => D.DISHES.filter(x => x.id === id)[0]).filter(Boolean);
            return `<div class="meal">
              <span class="slot">${slot}</span>
              <div class="meal-dishes">
                ${items.map(dd => `<span class="mname" data-dish="${dd.id}">${dd.emoji} ${esc(dd.name)}</span>`).join('<span class="sep">·</span>')}
              </div>
              ${m.missing ? '<span class="flag" style="background:#FEE2E2;color:#B91C1C">补料</span>' : ''}
            </div>`;
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
    const curSys = (fam && fam.system) || 'cn';
    const cur = D.SYSTEM_MAP[curSys] || D.MEAL_SYSTEMS[0];

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
        ${(fam.avoid || []).length ? `<div class="tiny" style="margin-top:6px;color:#B45309">过敏原：${fam.avoid.join(' · ')}</div>` : ''}
        ${(fam.conditions || []).length ? `<div class="tiny" style="margin-top:6px;color:#B45309">疾病史：${fam.conditions.join(' · ')}</div>` : ''}
        <div class="btn-row" style="margin-top:10px">
          <button class="btn ghost sm" data-action="openHealth">🩺 健康档案（过敏原 / 疾病史）</button>
        </div>
      </div>

      <div class="section-head"><div class="t">餐饮体系<small>决定一餐的结构</small></div></div>
      <div class="chips" style="padding-top:9px">
        ${D.MEAL_SYSTEMS.map(s => `<button class="chip ${curSys === s.key ? 'on' : ''}" data-system="${s.key}">${s.emoji} ${s.name}</button>`).join('')}
      </div>
      <div class="panel" style="margin-top:9px;padding:11px 14px">
        <div class="p-body" style="margin-top:0;font-size:11px">
          <b>${cur.emoji} ${cur.name}</b> · ${esc(cur.desc)}<br>
          <span class="tiny muted">${esc(cur.structure)}</span><br>
          <span class="tiny muted">早：${cur.slots['早'].join(' + ')}　午：${cur.slots['午'].join(' + ')}　晚：${cur.slots['晚'].join(' + ')}</span>
        </div>
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
        <button class="more" data-action="openNearby">附近超市 ›</button></div>
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
  function partyDateLabel(key) {
    const d = new Date(E.now());
    const md = x => (x.getMonth() + 1) + '月' + x.getDate() + '日';
    if (key === 'today') return '今天 ' + md(d);
    if (key === 'tomorrow') return '明天 ' + md(new Date(d.getTime() + 86400000));
    const target = key === 'sat' ? 6 : 5;
    const diff = (target - d.getDay() + 7) % 7;
    const t = new Date(d.getTime() + diff * 86400000);
    return (key === 'sat' ? '周六 ' : '周五 ') + md(t);
  }

  function viewPartyForm() {
    const P = w.DD_VIEW.party;
    const dates = [
      { k: 'today', t: '今天' }, { k: 'tomorrow', t: '明天' },
      { k: 'fri', t: '本周五' }, { k: 'sat', t: '本周六' }
    ];
    const total = P.men + P.women + P.kids;
    return {
      title: '聚餐规划', tab: 'plan', back: true,
      html: `
      <div class="panel">
        <h3><span class="dot"></span>📅 什么时候吃</h3>
        <div class="chips" style="padding:10px 0 2px">
          ${dates.map(d => `<button class="chip ${P.dateKey === d.k ? 'on' : ''}" data-party-date="${d.k}">${d.t}</button>`).join('')}
        </div>
        <div class="tiny muted" style="margin-top:8px">当前选择：${partyDateLabel(P.dateKey)}</div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>👥 来几个人</h3>
        <div class="small muted" style="margin-top:6px">男 / 女 / 小孩按不同食量折算，菜量和采购量跟着变</div>
        ${[['men', '👨 男士', 1.2], ['women', '👩 女士', 1.0], ['kids', '🧒 小孩', 0.6]].map(it => `
          <div class="stepper">
            <span class="sl">${it[1]}<small>×${it[2]} 食量</small></span>
            <div class="st">
              <button data-action="partyStep" data-k="${it[0]}" data-d="-1">−</button>
              <b>${P[it[0]]}</b>
              <button data-action="partyStep" data-k="${it[0]}" data-d="1">+</button>
            </div>
          </div>`).join('')}
        <div class="row between" style="margin-top:10px">
          <span class="small muted">合计</span>
          <span class="small bold">${total} 人</span>
        </div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>🍽 吃什么菜系</h3>
        <div class="chips" style="padding:10px 0 2px">
          <button class="chip ${!P.cuisine ? 'on' : ''}" data-party-cuisine="">不限</button>
          ${D.CUISINES.map(c => `<button class="chip ${P.cuisine === c ? 'on' : ''}" data-party-cuisine="${c}">${c}</button>`).join('')}
        </div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>🍜 想吃的菜 / 口味</h3>
        <div class="onb-field" style="margin-top:10px">
          <label>朋友点名的菜（可不填，多个用顿号隔开）</label>
          <input id="partyWish" value="${esc(P.wish || '')}" placeholder="如：水煮鱼、红烧肉、糖醋排骨" maxlength="40">
        </div>
        <div class="onb-field" style="margin-top:10px">
          <label>口味偏好（可不填）</label>
          <input id="partyTaste" value="${esc(P.taste || '')}" placeholder="如：微辣、清淡点、川菜、少放油" maxlength="30">
        </div>
        <div class="onb-field" style="margin-top:10px">
          <label>这桌预算上限（可不填）</label>
          <input id="partyBudget" inputmode="numeric" value="${P.budget || ''}" placeholder="如 300（超了会自动换掉最贵的菜）" maxlength="6">
        </div>
        <div class="tiny muted" style="margin-top:9px;line-height:1.6">
          菜谱库有的直接排进这桌；没有的会列出来，并给出到平台搜做法的入口
        </div>
      </div>

      <button class="btn primary full" style="margin-top:14px" data-action="genParty">按这些条件排一桌 ›</button>
      <div class="tiny muted" style="text-align:center;margin-top:10px;line-height:1.6">
        会先盘点冰箱现有食材，只把真正缺的放进采购清单
      </div>
      `
    };
  }

  function viewParty() {
    const st = S.state;
    const p = st.party;
    if (!p) return viewPartyForm();

    const totalCost = p.missing.reduce((s, m) => s + (m.cost || 0), 0);
    return {
      title: '聚餐方案', tab: 'plan', back: true,
      html: `
      <div class="panel" style="background:linear-gradient(120deg,#FFF7F0,#FFFDFB);border:1px solid #FBEADF;box-shadow:none">
        <h3><span class="dot"></span>${esc(p.dateLabel || '')} · ${p.people} 人 · ${p.dishes.length} 道菜</h3>
        <div class="p-body">
          ${p.men ? '男 ' + p.men + ' ' : ''}${p.women ? '女 ' + p.women + ' ' : ''}${p.kids ? '小孩 ' + p.kids : ''}
          ${p.cuisine ? ' · ' + esc(p.cuisine) : ''} · 约 ${p.portions} 人份<br>
          已盘点冰箱全部食材，只有 <b>${p.missing.length}</b> 样需要补购${p.budget ? '，预估 ¥' + p.totalCost + '（预算 ¥' + p.budget + '）' : '，预估 ¥' + p.totalCost}。
          ${p.cuisineNote ? '<br><span style="color:#B45309">' + esc(p.cuisineNote) + '</span>' : ''}
          ${p.overBudget ? '<br><span style="color:#B91C1C">超出预算 ¥' + (p.totalCost - p.budget).toFixed(1) + '，建议减掉一两道或者提高预算</span>' : ''}
          ${p.dropped && p.dropped.length ? '<br><span style="color:#B45309">为控制预算已去掉：' + esc(p.dropped.join('、')) + '</span>' : ''}
        </div>
      </div>

      <div class="section-head"><div class="t">菜单<small>点开看教程</small></div></div>
      ${p.dishes.map(d => dishRow(d, E.ingredientState(d, st.foods).every(s => s.ok))).join('')}

      ${(p.wishMiss && p.wishMiss.length) ? `<div class="section-head"><div class="t">没找到菜谱<small>${p.wishMiss.length} 样</small></div></div>
        <div class="panel" style="margin-top:9px">
          <div class="p-body" style="margin-top:0">这几样菜谱库还没有，去平台搜同款做法，照着做完再拍照入库。</div>
          ${p.wishMiss.map(w => `<div class="ing">
            <div class="l">🍜 ${esc(w)}</div>
            <div class="q">
              <button class="pchip" data-ext="${E.videoSearch('bilibili', w)}">B站</button>
              <button class="pchip" data-ext="${E.videoSearch('douyin', w)}">抖音</button>
              <button class="pchip" data-ext="${E.videoSearch('xhs', w)}">小红书</button>
            </div>
          </div>`).join('')}
        </div>` : ''}

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
      <div class="btn-row">
        <button class="btn ghost" data-action="openParty">改条件重排</button>
        <button class="btn primary" data-action="genParty">换一桌</button>
      </div>
      <div style="height:8px"></div>
      `
    };
  }

  /* ---------------- 注册引导 ---------------- */
  function viewOnboarding() {
    const ob = w.DD_VIEW.onb;
    if (ob.step === 1) {
      return {
        title: '', hideNav: true, hideTab: true,
        html: `
        <div class="onb">
          <div class="onb-art">🧊</div>
          <h1>冰箱对对碰</h1>
          <div class="onb-sub">让冰箱里的每一份食物，都被看见、被吃掉</div>
          <div class="onb-step">第 1 / 2 步 · 认识一下</div>
          <div class="onb-field">
            <label>怎么称呼你</label>
            <input id="onbName" data-onb="name" value="${esc(ob.name)}" placeholder="如：林妈妈" maxlength="8">
          </div>
          <button class="btn primary full" style="margin-top:14px" data-action="onbNext">下一步 ›</button>

          <div class="onb-feats">
            <div><span>📷</span>拍一张照，AI 自动认食材、填保质期</div>
            <div><span>🟢</span>绿黄紫黑四色，一眼看出谁要坏了</div>
            <div><span>🍽</span>按家人年龄，自动排每天吃什么</div>
          </div>

          <button class="onb-skip" data-action="onbSkip">先随便看看（用示例家庭）</button>
        </div>`
      };
    }
    return {
      title: '', hideNav: true, hideTab: true,
      html: `
      <div class="onb onb-wide">
        <div class="onb-step">第 2 / 2 步 · 家里都有谁</div>
        <h1>家里都有谁？</h1>
        <div class="onb-sub">年龄和性别决定菜的软硬与营养配比，之后随时能改</div>

        <div class="member-list">${ob.members.map(memberRowHtml).join('')}</div>

        <button class="onb-add" data-action="onbAdd">+ 添加成员</button>
        <div class="onb-preset">
          <span>快速填入</span>
          <button data-action="onbPreset" data-p="two">两口之家</button>
          <button data-action="onbPreset" data-p="three">三口之家</button>
          <button data-action="onbPreset" data-p="four">三代同堂</button>
        </div>

        <div class="onb-field">
          <label>忌口 / 不吃（可留空）</label>
          <input data-onb="taboos" value="${esc(ob.taboos)}" placeholder="如：香菜、辣、海鲜" maxlength="20">
        </div>

        <button class="btn primary full" style="margin-top:16px" data-action="onbDone">生成我家的菜单 ›</button>
        <button class="onb-skip" data-action="onbBack">‹ 上一步</button>
      </div>`
    };
  }

  /* ---------------- 全局搜索 ---------------- */
  function viewSearch() {
    const q = (w.DD_VIEW.q || '').trim();
    const st = S.state;
    const res = E.smartSearch(q, st.foods);
    const hot = ['番茄炒蛋', '西兰花炒牛肉', '土豆', '川菜', '排骨', '清淡'];

    let body = '';
    if (!q) {
      body = `
        <div class="section-head"><div class="t">热门搜索</div></div>
        <div class="chips" style="padding-top:8px">
          ${hot.map(h => `<button class="chip" data-hot="${h}">${h}</button>`).join('')}
        </div>
        <div class="section-head"><div class="t">去平台看视频</div></div>
        <div class="panel" style="margin-top:9px">
          <div class="vplat">
            ${D.PLATFORMS.map(p => `<a class="vchip" href="${p.search('家常菜 做法')}" target="_blank" rel="noopener">${p.icon} ${p.name} · 家常菜</a>`).join('')}
          </div>
        </div>
        <div class="tiny muted" style="text-align:center;margin-top:14px;line-height:1.6">
          可以搜菜名、食材、菜系，也可以只搜「清淡」这类口味
        </div>`;
    } else {
      body = `
        ${res.changed ? `<div class="tiny muted" style="padding:8px 2px 0">已按「${esc(res.norm)}」搜索</div>` : ''}
        ${res.byIngredient ? `<div class="tiny muted" style="padding:8px 2px 0">没有叫「${esc(res.raw)}」的菜，按食材「${esc(res.guessed.join(' + '))}」找到这些：</div>` : ''}
        ${res.dishes.length ? `<div class="section-head"><div class="t">菜谱<small>${res.dishes.length} 道</small></div></div>
          ${res.dishes.map(d => dishRow(d, E.ingredientState(d, st.foods).every(s => s.ok))).join('')}` : ''}

        ${(!res.dishes.length && res.suggestion.length) ? `
          <div class="panel" style="margin-top:10px;background:linear-gradient(135deg,#FFF7EE,#FFFFFF 72%);border:1px solid #FBE3CF;box-shadow:none">
            <h3><span class="dot"></span>没收录「${esc(res.raw)}」</h3>
            <div class="p-body">
              菜谱库里还没有这道菜的做法。${res.guessed.length
                ? '不过你提到的是 <b>' + esc(res.guessed.join('、')) + '</b>，下面这几道用得上：'
                : '但下面这些可能接近你想要的做法：'}
            </div>
          </div>
          ${res.suggestion.map(d => dishRow(d, E.ingredientState(d, st.foods).every(s => s.ok))).join('')}
        ` : ''}

        ${(!res.dishes.length && !res.suggestion.length && res.guessed.length) ? `
          <div class="panel" style="margin-top:10px;background:linear-gradient(135deg,#FFF7EE,#FFFFFF 72%);border:1px solid #FBE3CF;box-shadow:none">
            <h3><span class="dot"></span>没收录「${esc(res.raw)}」</h3>
            <div class="p-body">
              菜谱库里还没有用 <b>${esc(res.guessed.join('、'))}</b> 做的菜。
              可以先去平台看做法，做好后拍照入库，下次就能直接排进菜单。
            </div>
          </div>` : ''}

        ${res.foods.length ? `<div class="section-head"><div class="t">冰箱里的食材<small>${res.foods.length} 件</small></div></div>
          <div class="panel" style="margin-top:9px;padding:6px 14px">
            ${res.foods.map(f => `<button class="ing" style="width:100%" data-food="${f.id}">
              <div class="l">${f.emoji} ${esc(f.name)} <span class="q">${E.fmtQty(f.qty)} ${esc(f.unit)}</span></div>
              <div class="q">${E.dayText(f)}</div>
            </button>`).join('')}
          </div>` : ''}

        <div class="section-head"><div class="t">视频<small>去平台找同款做法</small></div></div>
        <div class="panel" style="margin-top:9px">
          <div class="vplat">
            ${D.PLATFORMS.map(p => `<a class="vchip" href="${E.videoSearch(p.key, q)}" target="_blank" rel="noopener">${p.icon} 在${p.name}搜「${esc(q)}」</a>`).join('')}
          </div>
        </div>

        ${!res.dishes.length && !res.foods.length && !res.suggestion.length
          ? `<div class="empty"><div class="e">🔍</div><div class="t">没搜到「${esc(q)}」</div>
             <div class="d">换个词试试，比如「番茄」「排骨」「清淡」</div></div>` : ''}`;
    }

    return {
      title: '搜索', back: true, hideTab: true,
      html: `
      <div class="searchbar">
        <span style="font-size:13px">🔍</span>
        <input id="globalSearch" placeholder="搜菜名、食材、菜系…" value="${esc(q)}">
        ${q ? '<button class="sx" data-action="clearSearch">✕</button>' : ''}
      </div>
      ${body}`
    };
  }

  /* ---------------- 视频库 ---------------- */
  function videoLibBody() {
    const q = (w.DD_VIEW.vq || '').trim();
    const hit = d => !q || d.name.indexOf(q) >= 0;
    const withVideo = D.DISHES.filter(d => d.videos.length && hit(d));
    const others = D.DISHES.filter(d => !d.videos.length && hit(d));

    return `
      <div class="searchbar" style="margin-top:10px">
        <span style="font-size:13px">🔍</span>
        <input id="videoSearch" placeholder="搜菜名，看示范视频" value="${esc(q)}">
      </div>

      <div class="section-head"><div class="t">站内示范<small>${withVideo.length} 道</small></div>
        <div class="more">点封面直接在站内播</div></div>
      ${withVideo.length ? withVideo.map(d => `
        <div class="vcard">
          <button class="vcover" data-play="${d.videos[0].bvid}" data-title="${esc(d.videos[0].title)}">
            <span class="vplay-s">▶</span>
          </button>
          <div class="vinfo">
            <div class="vname">${d.emoji} ${esc(d.name)}</div>
            <div class="vtitle">${esc(d.videos[0].title)}</div>
            <div class="vrowbtn">
              <button class="vchip" data-play="${d.videos[0].bvid}" data-title="${esc(d.videos[0].title)}">▶ 站内播放</button>
              <button class="vchip" data-ext="${E.videoPage(d.videos[0].bvid)}">在 B 站打开 ›</button>
            </div>
          </div>
        </div>`).join('') : '<div class="empty"><div class="e">📺</div><div class="t">没有匹配的视频</div></div>'}

      <div class="section-head"><div class="t">去平台搜<small>其余 ${others.length} 道</small></div></div>
      <div class="panel" style="margin-top:9px;padding:4px 14px">
        ${others.length ? others.map(d => `
          <div class="vrowline">
            <span class="vn">${d.emoji} ${esc(d.name)}</span>
            <span class="vp">
              <button class="pchip" data-ext="${E.videoSearch('bilibili', d.name)}">B站</button>
              <button class="pchip" data-ext="${E.videoSearch('douyin', d.name)}">抖音</button>
              <button class="pchip" data-ext="${E.videoSearch('xhs', d.name)}">小红书</button>
            </span>
          </div>`).join('') : '<div class="p-body" style="margin-top:0">没有更多</div>'}
      </div>

      <div class="tiny muted" style="text-align:center;margin-top:14px;line-height:1.7">
        站内播放走哔哩哔哩官方播放器；平台链接在新标签打开，<br>如果浏览器拦了弹窗，会给出可复制的链接。
      </div>`;
  }

  /* ---------------- 登录 ---------------- */
  function viewLogin() {
    const V = w.DD_VIEW.login;
    return {
      title: '登录', tab: 'me',
      html: `
      <div class="login">
        <div class="login-logo">🧊</div>
        <h1>登录冰箱对对碰</h1>
        <div class="login-sub">登录后录入家里几口人、都几岁，AI 才知道该给谁做什么菜</div>

        <div class="onb-field" style="margin-top:22px">
          <label>手机号</label>
          <input id="loginPhone" inputmode="numeric" maxlength="11" placeholder="11 位手机号"
            value="${esc(V.phone)}">
        </div>

        <div class="onb-field" style="margin-top:14px">
          <label>验证码</label>
          <div class="code-row">
            <input id="loginCode" inputmode="numeric" maxlength="6" placeholder="6 位验证码" value="${esc(V.code)}">
            <button class="btn ghost sm" style="flex:none;width:106px" data-action="sendCode">${V.sent ? '重新获取' : '获取验证码'}</button>
          </div>
          ${V.sent ? '<div class="code-hint">演示环境验证码固定为 <b>123456</b>，不会真的发短信</div>' : ''}
        </div>

        <button class="btn primary full" style="margin-top:18px" data-action="loginSubmit">登录 / 注册</button>
        <button class="onb-skip" data-action="loginDemo">先看看演示（用示例家庭）</button>

        <div class="login-tip">首次登录会自动进入「家里几口人」档案页</div>

        <div class="onb-feats" style="margin-top:26px">
          <div><span>📷</span>拍一张照，AI 自动认食材、填保质期</div>
          <div><span>🟢</span>绿黄紫黑四色，一眼看出谁要坏了</div>
          <div><span>🍽</span>按家人年龄，自动排每天吃什么</div>
        </div>
      </div>`
    };
  }

  /* ---------------- 家庭档案（登录后第二屏） ---------------- */
  function viewFamilySetup() {
    const ob = w.DD_VIEW.onb;
    const n = ob.members.length;
    return {
      title: '家庭档案', tab: 'me', back: true,
      html: `
      <div class="onb-step">登录成功 · 最后一步</div>
      <h1 style="font-size:21px;font-weight:800;letter-spacing:.2px;margin-top:6px">家里有几口人？</h1>
      <div class="onb-sub">点数字快速生成对应人数，再填称呼和年龄——每天的菜单就是按这些排的</div>

      <div class="count-row">
        ${[1, 2, 3, 4, 5, 6, 7, 8].map(k => `<button class="cnt ${n === k ? 'on' : ''}" data-count="${k}">${k}</button>`).join('')}
      </div>

      <div class="member-list">${ob.members.map(memberRowHtml).join('')}</div>
      <button class="onb-add" data-action="onbAdd">+ 再加一位</button>

      <div class="onb-preset">
        <span>快速填入</span>
        <button data-action="onbPreset" data-p="two">两口之家</button>
        <button data-action="onbPreset" data-p="three">三口之家</button>
        <button data-action="onbPreset" data-p="four">三代同堂</button>
      </div>

      <div class="onb-field">
        <label>忌口 / 不吃（可留空）</label>
        <input data-onb="taboos" value="${esc(ob.taboos)}" placeholder="如：香菜、辣、海鲜" maxlength="20">
      </div>

      <div class="onb-field">
        <label>过敏原（可多选，排餐会自动避开）</label>
        <div class="chips" style="padding-top:8px">
          ${D.ALLERGENS.map(a => `<button class="chip ${(ob.avoid || []).indexOf(a) >= 0 ? 'on' : ''}" data-allergy="${a}">${a}</button>`).join('')}
        </div>
        <div class="tiny muted" style="margin-top:7px">选中的过敏原，相关菜谱不会排进菜单，菜谱详情也会提示</div>
      </div>

      <div class="onb-field">
        <label>疾病史（可多选，排餐会自动避开）</label>
        <div class="chips" style="padding-top:8px">
          ${D.CONDITIONS.map(c => `<button class="chip ${(ob.conditions || []).indexOf(c.key) >= 0 ? 'on' : ''}" data-condition="${c.key}">${c.emoji} ${c.key}</button>`).join('')}
        </div>
        <div class="tiny muted" style="margin-top:7px">高血压会避开腌制品，痛风会避开海鲜内脏，糖尿病会避开高糖菜</div>
      </div>

      <button class="btn primary full" style="margin-top:16px" data-action="famDone">保存并生成菜单 ›</button>`
    };
  }

  function memberRowHtml(m, i) {
    return `<div class="mrow">
      <div class="mr-top">
        <input data-onb="mname" data-i="${i}" value="${esc(m.name || '')}" placeholder="称呼，如：奶奶" maxlength="6">
        <button class="mr-del" data-action="onbDel" data-i="${i}">✕</button>
      </div>
      <div class="mr-bot">
        <select data-onb="role" data-i="${i}">
          ${['成人', '老人', '幼儿'].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <select data-onb="gender" data-i="${i}">
          ${['女', '男'].map(g => `<option value="${g}" ${m.gender === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
        <input type="number" data-onb="age" data-i="${i}" value="${m.age}" min="0" max="110" placeholder="年龄">
      </div>
    </div>`;
  }

  /* ---------------- 周报 ---------------- */
  function viewReport() {
    const st = S.state;
    const r = E.weeklyReport(st);
    const total = r.counts.g + r.counts.y + r.counts.p + r.counts.b;
    return {
      title: '本周报告', back: true, tab: 'me',
      html: `
      <div class="panel" style="background:linear-gradient(135deg,#FFF6EE,#FFFFFF 72%);border:1px solid rgba(255,150,100,.16);box-shadow:none">
        <h3><span class="dot"></span>这周的冰箱体检</h3>
        <div class="p-body">
          冰箱共 <b>${total}</b> 件，其中临期 <b>${r.counts.p}</b> 件、过期 <b>${r.counts.b}</b> 件。
          做菜 <b>${r.cooked}</b> 顿，挽回浪费约 <b>¥${r.saved.toFixed(1)}</b>。
        </div>
      </div>

      <div class="statmini">
        <div class="s"><div class="v">${r.cooked}</div><div class="l">做菜（顿）</div></div>
        <div class="s"><div class="v" style="color:#16A34A">¥${r.saved.toFixed(0)}</div><div class="l">挽回浪费</div></div>
        <div class="s"><div class="v">${r.trashed}</div><div class="l">清理过期</div></div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>浪费率</h3>
        <div class="p-body">清理 / （做菜 + 清理）= <b>${r.wasteRate}%</b></div>
        <div class="nb-bar" style="height:9px;margin-top:9px;position:relative">
          <i style="width:${Math.min(100, r.wasteRate)}%;background:linear-gradient(90deg,#4ADE80,#F0A020 55%,#FF5C7A)"></i>
          <span style="position:absolute;left:10%;top:-4px;width:1.5px;height:17px;background:#B7BEC9;opacity:.8"></span>
        </div>
        <div class="row between" style="margin-top:6px">
          <span class="tiny muted">0%</span>
          <span class="tiny" style="color:#B7BEC9">10% 及格线</span>
          <span class="tiny muted">25%</span>
        </div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>下周建议</h3>
        <div class="p-body">${r.tips.map(t => '· ' + esc(t)).join('<br>')}</div>
      </div>

      ${r.urgent.length ? `<div class="section-head"><div class="t">还在临期<small>${r.urgent.length} 件</small></div></div>
        <div class="panel" style="margin-top:9px"><div class="p-body" style="margin-top:0">${esc(r.urgent.join('、'))}</div>
        <div class="btn-row"><button class="btn primary sm" data-action="genMenu">排临期菜单</button></div></div>` : ''}

      <div class="btn-row"><button class="btn ghost" data-action="back">返回</button></div>
      <div style="height:8px"></div>`
    };
  }

  /* ---------------- 附近超市 ---------------- */
  function viewNearby() {
    const st = S.state;
    const N = w.DD_VIEW.nearby || {};
    const cart = st.cart || [];
    const hasGeo = !!(N.lat && N.lng);
    const kw = '超市';
    const amap = `https://uri.amap.com/search?keyword=${encodeURIComponent(kw)}&center=${N.lng},${N.lat}&city=${encodeURIComponent(N.city || '')}&callnative=0`;
    const baidu = `https://map.baidu.com/search/${encodeURIComponent(kw)}/@${N.lng},${N.lat},14z`;
    const qqmap = `https://apis.map.qq.com/uri/v1/search?keyword=${encodeURIComponent(kw)}&center=${N.lat},${N.lng}&referer=fridge`;
    const bbox = hasGeo ? [N.lng - 0.018, N.lat - 0.011, N.lng + 0.018, N.lat + 0.011].map(v => v.toFixed(4)).join(',') : '';
    const osm = hasGeo
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${N.lat},${N.lng}`
      : '';

    const statusText = {
      idle: '点「找附近超市」开始搜索',
      locating: '正在获取定位…',
      loading: '正在搜索附近超市…',
      ok: `找到 ${(N.shops || []).length} 家`,
      fail: '地图数据源连不上，已切换成地图 App 搜索（下面可以直接点）',
      denied: '没有拿到定位权限，已用默认城市'
    }[N.status || 'idle'];

    return {
      title: '附近超市', back: true, tab: 'plan',
      html: `
      <div class="panel" style="background:linear-gradient(135deg,#F0FBF4,#FFFFFF 72%);border:1px solid #D8F3E2;box-shadow:none">
        <h3><span class="dot" style="background:#16A34A"></span>现在的位置</h3>
        <div class="p-body">
          <b>${esc(N.city || '未设置')}</b>
          <span class="tiny muted" style="margin-left:6px">${hasGeo ? N.lat.toFixed(4) + ', ' + N.lng.toFixed(4) : ''}</span>
          <br><span class="tiny muted">定位来源：${esc(N.src || '默认城市')}</span>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn ghost sm" data-action="locate">📍 重新定位</button>
          <button class="btn primary sm" data-action="findShops">🔍 找附近超市</button>
        </div>
      </div>

      <div class="panel">
        <h3><span class="dot"></span>${N.status === 'ok' ? '最近的几家' : '搜索'}</h3>
        <div class="p-body" style="margin-top:2px">
          <span class="${N.status === 'fail' ? 'warn-text' : 'muted'}">${esc(statusText)}</span>
        </div>
        ${(N.shops && N.shops.length) ? N.shops.map(s => `
          <div class="shop">
            <div class="shop-ic">🛒</div>
            <div class="shop-in">
              <div class="shop-nm">${esc(s.name)}</div>
              <div class="shop-meta">${s.dist} m · ${esc(s.kind || '超市')}</div>
            </div>
            <div class="shop-btns">
              <button class="pchip" data-ext="https://uri.amap.com/search?keyword=${encodeURIComponent(s.name)}&center=${N.lng},${N.lat}&city=${encodeURIComponent(N.city || '')}&callnative=0">高德</button>
              <button class="pchip" data-ext="https://map.baidu.com/search/${encodeURIComponent(s.name)}/@${N.lng},${N.lat},16z">百度</button>
            </div>
          </div>`).join('') : ''}
      </div>

      <div class="section-head"><div class="t">在地图里找<small>不用装 App 也能看</small></div></div>
      <div class="panel" style="margin-top:9px">
        <div class="vplat" style="margin-top:2px">
          <button class="vchip" data-ext="${amap}">🗺 高德地图 · 搜超市</button>
          <button class="vchip" data-ext="${baidu}">🗺 百度地图 · 搜超市</button>
          <button class="vchip" data-ext="${qqmap}">🗺 腾讯地图 · 搜超市</button>
        </div>
        ${osm ? `<button class="vchip" style="margin-top:10px" data-action="toggleMap">${w.DD_VIEW.showMap ? '收起地图' : '展开地图预览'}</button>
          ${w.DD_VIEW.showMap ? `<div class="mapbox"><iframe src="${osm}" loading="lazy" referrerpolicy="no-referrer"></iframe></div>` : ''}`
          : `<div class="tiny muted" style="margin-top:10px">先定位才能显示地图预览</div>`}
      </div>

      <div class="section-head"><div class="t">带着清单去买<small>${cart.length} 项</small></div></div>
      <div class="panel" style="margin-top:9px">
        ${cart.length ? cart.map(c => `<div class="cart-item">
          <span class="em">${c.emoji}</span>
          <span class="nm">${esc(c.name)}</span>
          <span class="q">${E.fmtQty(c.qty)} ${esc(c.unit)}</span>
        </div>`).join('') + `<div class="btn-row"><button class="btn ghost sm" data-action="copyCart">复制清单</button></div>`
        : `<div class="p-body" style="margin-top:0">采购清单是空的，先去聚餐规划或菜谱里加几样。</div>`}
      </div>

      ${(N.cities) ? '' : ''}
      <div class="section-head"><div class="t">换个城市</div></div>
      <div class="chips" style="padding-top:9px">
        ${['杭州', '北京', '上海', '深圳', '广州', '成都', '武汉', '西安'].map(c =>
          `<button class="chip ${N.city === c ? 'on' : ''}" data-city="${c}">${c}</button>`).join('')}
      </div>
      <div class="tiny muted" style="text-align:center;margin-top:14px;line-height:1.7">
        店铺数据来自 OpenStreetMap 公开接口；连不上时会退到地图 App 搜索，<br>它们会直接告诉你最近的门店和路线。
      </div>
      <div style="height:8px"></div>`
    };
  }

  /* ---------------- 健康档案（过敏原 / 疾病史） ---------------- */
  function viewHealth() {
    const h = w.DD_VIEW.healthDraft || { avoid: [], conditions: [], taboos: '' };
    const blocked = D.DISHES.filter(function (d) {
      return !E.dishAllowed(d, h.avoid) || E.conditionPenalty(d, h.conditions) <= -100;
    }).length;

    return {
      title: '健康档案', back: true, tab: 'me',
      html: `
      <div class="panel" style="background:linear-gradient(135deg,#F2FBF5,#FFFFFF 72%);border:1px solid #D8F3E2;box-shadow:none">
        <h3><span class="dot" style="background:#16A34A"></span>这些会直接影响排餐</h3>
        <div class="p-body">
          选中的过敏原和疾病史，会从菜谱库里剔除对应的菜。当前设置会避开 <b>${blocked}</b> 道（共 ${D.DISHES.length} 道）。
        </div>
      </div>

      <div class="section-head"><div class="t">过敏原<small>可多选</small></div></div>
      <div class="chips" style="padding-top:9px">
        ${D.ALLERGENS.map(a => `<button class="chip ${h.avoid.indexOf(a) >= 0 ? 'on' : ''}" data-allergy="${a}">${a}</button>`).join('')}
      </div>

      <div class="section-head"><div class="t">疾病史<small>可多选</small></div></div>
      <div class="chips" style="padding-top:9px">
        ${D.CONDITIONS.map(c => `<button class="chip ${h.conditions.indexOf(c.key) >= 0 ? 'on' : ''}" data-condition="${c.key}">${c.emoji} ${c.key}</button>`).join('')}
      </div>
      ${h.conditions.length ? `<div class="panel" style="margin-top:10px;padding:6px 14px">
        ${h.conditions.map(function (k) {
          const c = D.CONDITION_MAP[k];
          return `<div class="ing"><div class="l">${c.emoji} ${esc(c.key)}</div><div class="q">${esc(c.note)}</div></div>`;
        }).join('')}
      </div>` : ''}

      <div class="onb-field">
        <label>忌口 / 不吃（可留空）</label>
        <input id="healthTaboo" value="${esc(h.taboos || '')}" placeholder="如：香菜、辣、海鲜" maxlength="20">
      </div>

      <button class="btn primary full" style="margin-top:16px" data-action="saveHealth">保存并重排菜单</button>
      <div class="tiny muted" style="text-align:center;margin-top:12px;line-height:1.6">
        也可以从「我的 → 家庭档案」里改家庭成员信息
      </div>
      <div style="height:6px"></div>`
    };
  }

  /* ---------------- 我的 ---------------- */
  function viewMe() {
    const st = S.state;
    if (!st.family.loggedIn) return viewLogin();

    const sum = E.summary(st);
    const cart = st.cart || [];
    const off = st.clockOffset || 0;
    const phone = st.family.phone || '';
    const masked = phone ? phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '未绑定手机号';

    return {
      title: '我的', tab: 'me',
      html: `
      <div class="acct">
        <div class="acct-av">🧑‍🍳</div>
        <div class="acct-in">
          <div class="acct-nm">${esc(st.family.name)}</div>
          <div class="acct-ph">${masked} · ${(st.family.members || []).length} 位家人</div>
        </div>
        <div class="acct-ok">已登录</div>
      </div>

      <div class="hello" style="margin-top:14px"><div>
        <h1>${esc(st.family.name)}的厨房</h1>
        <p>使用第 ${Math.max(1, Math.ceil((E.now() - st.createdAt) / 86400000))} 天 · 冰箱 ${sum.total} 件</p>
      </div></div>

      <div class="statmini">
        <div class="s"><div class="v">${sum.cooked}</div><div class="l">已做菜（顿）</div></div>
        <div class="s"><div class="v" style="color:#16A34A">¥${sum.saved.toFixed(0)}</div><div class="l">挽回浪费</div></div>
        <div class="s"><div class="v">${st.stats.trashed || 0}</div><div class="l">清理过期</div></div>
      </div>

      <div class="section-head"><div class="t">家庭档案</div>
        <button class="more" data-action="editFamily">编辑 ›</button></div>
      <div class="panel" style="margin-top:9px;padding:7px 14px">
        ${(st.family.members || []).length ? st.family.members.map((m, i) => `<div class="ing">
          <div class="l">${m.role === '幼儿' ? '👶' : m.role === '老人' ? '👵' : (m.gender === '男' ? '👨' : '👩')}
            ${esc(m.name || ('家人' + (i + 1)))} · ${esc(m.role)}</div>
          <div class="q">${m.age} 岁${m.gender ? ' · ' + m.gender : ''}</div>
        </div>`).join('') : '<div class="p-body" style="margin-top:0">还没填家庭成员</div>'}
        ${st.family.taboos ? `<div class="tiny muted" style="padding:8px 0 4px">忌口：${esc(st.family.taboos)}</div>` : ''}
      </div>

      <div class="section-head"><div class="t">健康档案<small>过敏原 · 疾病史</small></div>
        <button class="more" data-action="openHealth">编辑 ›</button></div>
      <button class="dish" data-action="openHealth" style="margin-top:9px">
        <div class="em" style="background:linear-gradient(140deg,#F0FBF4,#E4F7EC)">🩺</div>
        <div class="bd">
          <div class="nm">过敏原与疾病史</div>
          <div class="ds">${(st.family.avoid || []).length ? '过敏原：' + esc(st.family.avoid.join(' / ')) : '过敏原：未设置'}
            · ${(st.family.conditions || []).length ? '疾病史：' + esc(st.family.conditions.join(' / ')) : '疾病史：未设置'}</div>
        </div>
        <div class="go">›</div>
      </button>

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

      <div class="section-head"><div class="t">本周报告</div>
        <button class="more" data-report="1">看详情 ›</button></div>
      <div class="panel" style="margin-top:9px;padding:7px 14px">
        <div class="ing"><div class="l">🍳 本周做菜</div><div class="q">${st.stats.cooked || 0} 顿</div></div>
        <div class="ing"><div class="l">💰 挽回浪费</div><div class="q">¥${((st.stats.saved || 0)).toFixed(1)}</div></div>
        <div class="ing"><div class="l">🗑 清理过期</div><div class="q">${st.stats.trashed || 0} 件</div></div>
      </div>

      <div class="section-head"><div class="t">设置</div></div>
      <div class="panel" style="margin-top:9px;padding:7px 14px">
        <div class="field">
          <div class="lab">深色模式<small>晚上看更护眼</small></div>
          <button class="chip" data-action="toggleDark">${(w.document.documentElement.dataset.theme === 'dark') ? '已开启' : '已关闭'}</button>
        </div>
        <div class="field">
          <div class="lab">数据导出<small>导成 JSON 备份</small></div>
          <button class="chip" data-action="exportData">导出</button>
        </div>
        <div class="field">
          <div class="lab">问问冰箱<small>对话式找菜</small></div>
          <button class="chip" data-action="openChat">打开</button>
        </div>
        <div class="field">
          <div class="lab">助手图标<small>按住可以拖到任意位置</small></div>
          <button class="chip" data-action="resetFab">恢复默认位置</button>
        </div>
      </div>

      <div class="section-head"><div class="t">数据</div></div>
      <div class="panel" style="margin-top:8px">
        <div class="p-body" style="margin-top:0">所有数据存在本机浏览器（localStorage），不会上传。刷新或关闭后仍在。
          <br><span class="tiny muted">版本 ${w.DD_VERSION || 'v11'} · 如果页面看着不对，按 Ctrl+F5 强刷</span>
        </div>
        <div class="btn-row"><button class="btn soft" data-action="reset">恢复示例数据</button></div>
      </div>

      <div class="btn-row" style="margin-top:12px">
        <button class="btn ghost" data-action="openNearby">🗺 附近超市</button>
        <button class="btn ghost" data-action="logout">退出登录</button>
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
      case 'onboarding': return viewOnboarding();
      case 'login': return viewLogin();
      case 'family': return viewFamilySetup();
      case 'search': return viewSearch();
      case 'nearby': return viewNearby();
      case 'health': return viewHealth();
      case 'report': return viewReport();
      default: return viewFridge();
    }
  }

  w.DD_UI = { render, esc, foodCard, dishRow, partyDateLabel };
})(window);
