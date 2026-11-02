/* ============================================================
   冰箱对对碰 · 业务引擎
   四色分级 / 相生相克 / 可做菜谱 / 一周配餐 / 聚餐补货
   ============================================================ */
(function (w) {
  'use strict';
  const D = w.DD_DATA;
  const DAY = 86400000;

  /* ---------- 时间 ---------- */
  function now() {
    const off = (w.DD_STORE && w.DD_STORE.state && w.DD_STORE.state.clockOffset) || 0;
    return Date.now() + off;
  }

  /* ---------- 四色分级 ----------
     ⚫ 已过期 : 剩余 ≤ 0 天
     🟣 临期   : 剩余 1~2 天（必须优先吃掉）
     🟡 正常   : 剩余 3~5 天（常规轮换）
     🟢 充足   : 剩余 ≥ 6 天（安心存放）
     阈值集中在这里，方便按业务调整。 */
  const TIER_RULES = { purple: 2, yellow: 5 };
  const TIERS = {
    g: { key: 'g', label: '充足', emoji: '🟢', hint: '保质期充足，安心存放', color: '#22C55E' },
    y: { key: 'y', label: '正常', emoji: '🟡', hint: '正常新鲜，建议常规轮换', color: '#EAAA08' },
    p: { key: 'p', label: '临期', emoji: '🟣', hint: '高度临期，必须优先吃掉', color: '#8B5CF6' },
    b: { key: 'b', label: '过期', emoji: '⚫', hint: '已过期，禁止食用，请清理', color: '#4B5563' }
  };

  function daysLeft(food) { return Math.ceil((food.expireAt - now()) / DAY); }

  function tier(food) {
    const d = daysLeft(food);
    if (d <= 0) return 'b';
    if (d <= TIER_RULES.purple) return 'p';
    if (d <= TIER_RULES.yellow) return 'y';
    return 'g';
  }

  const TIER_WEIGHT = { g: 1, y: 3, p: 7, b: -100 };

  function counts(foods) {
    const c = { g: 0, y: 0, p: 0, b: 0 };
    foods.forEach(f => { c[tier(f)]++; });
    return c;
  }

  /* ---------- 格式化 ---------- */
  function fmtQty(n) {
    if (n === null || n === undefined) return '';
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  function dayText(food) {
    const d = daysLeft(food);
    if (d === 0) return '今天到期';
    if (d < 0) return '已过期 ' + Math.abs(d) + ' 天';
    if (d === 1) return '仅剩 1 天';
    return '剩 ' + d + ' 天';
  }
  function dateLabel(ts) {
    const d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /* ---------- 库存工具 ---------- */
  function byName(foods) {
    const m = {};
    foods.forEach(f => { if (!m[f.name]) m[f.name] = f; });
    return m;
  }
  function findFood(foods, name) {
    for (let i = 0; i < foods.length; i++) if (foods[i].name === name) return foods[i];
    return null;
  }
  function foodMeta(name) { return D.FOOD_MAP[name] || { name: name, emoji: '🍽', unit: '份', price: 5, cat: '其他', shelf: 7 }; }

  /* ---------- 相生相克 ---------- */
  function pairList(foods, onlyPresent) {
    const have = byName(foods);
    return D.PAIRS.filter(p => {
      const a = have[p.a], b = have[p.b];
      if (!onlyPresent) return true;
      if (!a || !b) return false;
      return tier(a) !== 'b' && tier(b) !== 'b';
    }).map(p => {
      const a = have[p.a], b = have[p.b];
      const score = a && b ? TIER_WEIGHT[tier(a)] + TIER_WEIGHT[tier(b)] : 0;
      return Object.assign({}, p, { score: score, present: !!(a && b) });
    });
  }

  function topSuggestion(foods, offset) {
    const list = pairList(foods, true).filter(p => p.type === 'syn' && p.dish);
    list.sort((x, y) => y.score - x.score);
    if (list.length) return list[(offset || 0) % list.length];
    // 没有相生组合时，退化为"最临期的两样食材"
    const live = foods.filter(f => tier(f) !== 'b').sort((a, b) => daysLeft(a) - daysLeft(b));
    if (live.length >= 2) {
      return { a: live[0].name, b: live[1].name, type: 'fallback', title: '临期优先组合', dish: null, score: 0,
               desc: '这两样最快要过期，建议今天先处理掉其中一样。' };
    }
    return null;
  }

  function urgentList(foods) {
    return foods.filter(f => tier(f) === 'p').sort((a, b) => daysLeft(a) - daysLeft(b));
  }

  /* ---------- 菜谱匹配 ---------- */
  function ingredientState(dish, foods) {
    const have = byName(foods);
    return dish.ingredients.map(i => {
      const f = have[i.name];
      const enough = !!f && f.qty >= i.qty - 1e-6 && tier(f) !== 'b';
      return {
        name: i.name, qty: i.qty, unit: foodMeta(i.name).unit, emoji: foodMeta(i.name).emoji,
        have: !!f, haveQty: f ? f.qty : 0, ok: enough,
        expired: !!f && tier(f) === 'b'
      };
    });
  }

  function cookable(foods) {
    return D.DISHES.filter(d => ingredientState(d, foods).every(s => s.ok));
  }

  function nearMiss(foods) {
    return D.DISHES.filter(d => {
      const st = ingredientState(d, foods);
      const missing = st.filter(s => !s.ok);
      return missing.length === 1 && !st.some(s => s.expired);
    }).map(d => {
      const st = ingredientState(d, foods);
      return { dish: d, need: st.find(s => !s.ok) };
    });
  }

  function dishScore(dish, foods) {
    const st = ingredientState(dish, foods);
    let s = 0;
    st.forEach(x => {
      if (!x.ok) return;
      const f = findFood(foods, x.name);
      s += TIER_WEIGHT[tier(f)];
    });
    return s;
  }

  /* ---------- 做菜：扣减库存 ---------- */
  function cook(dish, state) {
    const res = { used: [], removed: [], saved: 0 };
    dish.ingredients.forEach(ing => {
      const f = findFood(state.foods, ing.name);
      if (!f) return;
      const before = f.qty;
      f.qty = Math.max(0, Math.round((f.qty - ing.qty) * 100) / 100);
      res.used.push({ name: ing.name, qty: ing.qty, unit: foodMeta(ing.name).unit, left: f.qty });
      if (f.qty <= 0) {
        const meta = foodMeta(ing.name);
        res.removed.push(f.name);
        res.saved += (meta.price || 0) * before;
      }
    });
    state.foods = state.foods.filter(f => f.qty > 0);
    state.stats = state.stats || { cooked: 0, saved: 0 };
    state.stats.cooked++;
    state.stats.saved += res.saved;
    return res;
  }

  /* ---------- 一周配餐 ---------- */
  const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function planWeek(state) {
    const foods = state.foods.slice();
    const virt = {};
    foods.forEach(f => { virt[f.name] = { qty: f.qty, tier: tier(f) }; });

    const usedAt = {};
    const days = [];

    function virtualCheck(dish) {
      let sum = 0, okAll = true;
      dish.ingredients.forEach(i => {
        const v = virt[i.name];
        if (!v || v.qty < i.qty - 1e-6) { okAll = false; return; }
        sum += TIER_WEIGHT[v.tier] || 1;
      });
      return { okAll: okAll, score: sum };
    }

    for (let i = 0; i < 7; i++) {
      const date = now() + i * DAY;
      const dt = new Date(date);
      const day = {
        idx: i,
        label: i === 0 ? '今天' : (i === 1 ? '明天' : WD[dt.getDay()]),
        date: (dt.getMonth() + 1) + '/' + dt.getDate(),
        meals: {},
        notes: []
      };

      ['早', '午', '晚'].forEach(slot => {
        const cands = D.DISHES.filter(d => d.meals.indexOf(slot) >= 0);
        let best = null, bestScore = -1e9, bestOk = false;

        cands.forEach(d => {
          const chk = virtualCheck(d);
          let s = chk.score;
          if (!chk.okAll) s -= 14;
          if (usedAt[d.id] !== undefined) s -= 10;   // 一周内尽量不重复
          if (usedAt[d.id] === i) s -= 16;           // 同一天内不重复
          if (usedAt[d.id] === i - 1) s -= 8;        // 相邻两天不重复
          if (slot === '早' && d.minutes > 25) s -= 6;
          if (slot === '晚' && d.minutes > 60) s -= 2;
          s += Math.random() * 2;
          if (s > bestScore) { bestScore = s; best = d; bestOk = chk.okAll; }
        });

        if (!best) return;
        day.meals[slot] = { id: best.id, missing: !bestOk };
        usedAt[best.id] = i;

        // 虚拟扣减，让后几天不会重复消耗同一批食材
        if (bestOk) {
          best.ingredients.forEach(ing => {
            if (virt[ing.name]) virt[ing.name].qty = Math.max(0, virt[ing.name].qty - ing.qty);
          });
        }
      });

      // 当天营养备注
      const ids = Object.keys(day.meals).map(k => day.meals[k].id);
      const ds = ids.map(id => D.DISHES.find(d => d.id === id)).filter(Boolean);
      const tagSet = {};
      ds.forEach(d => (d.tags || []).forEach(t => { tagSet[t] = (tagSet[t] || 0) + 1; }));
      const order = ['补铁', '补钙', '高蛋白', '清淡', '孩子爱吃', '老人友好', '幼儿', '控糖', '低脂', 'Omega-3'];
      day.notes = order.filter(t => tagSet[t]).slice(0, 3);

      days.push(day);
    }
    return days;
  }

  /* ---------- 聚餐规划 ----------
     opts: { men, women, kids, cuisine, dateLabel, wish, taste } 或直接传人数 */
  function parseTaste(t) {
    if (!t) return '';
    if (/川|辣|麻|花椒/.test(t)) return '川菜';
    if (/粤|煲|老火|靓汤|蒸/.test(t)) return '粤菜';
    if (/西|意面|牛排|沙拉|奶香|黄油/.test(t)) return '西式';
    if (/清淡|养生|少油|软|烂|老人/.test(t)) return '清淡';
    if (/家常/.test(t)) return '家常';
    return '';
  }

  function partyPlan(state, opts) {
    if (typeof opts === 'number') opts = { people: opts };
    opts = opts || {};

    const men = opts.men | 0, women = opts.women | 0, kids = opts.kids | 0;
    const people = Math.max(1, men + women + kids || opts.people || 4);
    const portions = Math.max(1, men * 1.2 + women * 1.0 + kids * 0.6 || people);
    const tasteCuisine = parseTaste(opts.taste || '');
    const cuisine = opts.cuisine || tasteCuisine || '';
    const target = Math.min(8, Math.max(3, Math.ceil(portions * 1.05)));

    const wishNames = String(opts.wish || '')
      .split(/[、,，;；\s+／/]+/).map(s => s.trim()).filter(Boolean).slice(0, 6);

    const foods = state.foods;
    const sorted = D.DISHES.slice().sort(function (a, b) {
      const ca = cuisine && a.cuisine.indexOf(cuisine) >= 0 ? 1 : 0;
      const cb = cuisine && b.cuisine.indexOf(cuisine) >= 0 ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return dishScore(b, foods) - dishScore(a, foods);
    });
    const cuisineHit = cuisine ? sorted.filter(d => d.cuisine.indexOf(cuisine) >= 0).length : 0;
    const picked = [];
    const wantMeat = ['牛里脊', '排骨', '鸡翅', '三文鱼'];

    // 荤 2 / 素 1 / 汤 1 / 蛋豆 1 / 凉菜水果 1
    const buckets = [
      { test: d => d.ingredients.some(i => wantMeat.indexOf(i.name) >= 0), n: 2 },
      { test: d => d.ingredients.some(i => ['西兰花', '菠菜', '青椒', '土豆', '香菇'].indexOf(i.name) >= 0), n: 1 },
      { test: d => d.tags.indexOf('清淡') >= 0 || d.name.indexOf('汤') >= 0, n: 1 },
      { test: d => d.ingredients.some(i => ['鸡蛋', '豆腐', '牛奶'].indexOf(i.name) >= 0), n: 1 },
      { test: d => d.tags.indexOf('早餐') >= 0 || d.ingredients.some(i => ['苹果', '香蕉', '酸奶'].indexOf(i.name) >= 0), n: 1 }
    ];

    buckets.forEach(b => {
      let got = 0;
      for (const d of sorted) {
        if (got >= b.n || picked.length >= target) break;
        if (picked.some(p => p.id === d.id)) continue;
        if (!b.test(d)) continue;
        picked.push(d); got++;
      }
    });
    // 补齐到目标道数
    for (const d of sorted) {
      if (picked.length >= target) break;
      if (!picked.some(p => p.id === d.id)) picked.push(d);
    }

    // 聚餐要有一道"硬菜"：全桌都现成时，换一道需要补购的，才看得出补货能力
    const allReady = picked.every(d => ingredientState(d, foods).every(s => s.ok));
    if (allReady) {
      const hard = sorted.filter(d => !picked.some(p => p.id === d.id)).find(d => {
        const miss = ingredientState(d, foods).filter(s => !s.ok).length;
        return miss >= 1 && miss <= 2;
      });
      if (hard) picked[picked.length - 1] = hard;
    }

    // 朋友点名的菜：能在菜谱库里找到的，直接排进这一桌
    const wishHit = [], wishMiss = [];
    wishNames.forEach(function (nm) {
      const hit = D.DISHES.filter(d => d.name.indexOf(nm) >= 0 || nm.indexOf(d.name) >= 0)[0];
      if (hit) {
        if (!wishHit.some(x => x.id === hit.id)) wishHit.push(hit);
        if (!picked.some(p => p.id === hit.id)) picked.unshift(hit);
      } else {
        wishMiss.push(nm);
      }
    });

    // 缺料汇总（按份量放大）
    const missMap = {};
    picked.forEach(d => {
      ingredientState(d, foods).forEach(s => {
        if (s.ok) return;
        const need = Math.max(0, s.qty - s.haveQty);
        if (!missMap[s.name]) {
          const m = foodMeta(s.name);
          missMap[s.name] = { name: s.name, emoji: m.emoji, unit: m.unit, qty: 0, price: m.price || 0, expired: s.expired };
        }
        missMap[s.name].qty += need;
      });
    });
    const scale = Math.max(1, portions / 3);
    const missing = Object.values(missMap).map(m => {
      m.qty = Math.ceil(m.qty * scale * 10) / 10;
      m.cost = Math.round(m.qty * m.price * 10) / 10;
      return m;
    });

    return {
      people: people, portions: Math.round(portions * 10) / 10,
      men: men, women: women, kids: kids,
      cuisine: cuisine, dateLabel: opts.dateLabel || '',
      taste: opts.taste || '',
      wishHit: wishHit.map(d => d.name),
      wishMiss: wishMiss,
      cuisineHit: cuisineHit,
      cuisineNote: cuisine && cuisineHit < 2
        ? ('「' + cuisine + '」现有 ' + cuisineHit + ' 道，其余按家常口味补齐')
        : '',
      dishes: picked.slice(0, Math.max(target, wishHit.length)), missing: missing
    };
  }

  /* ---------- 今天吃什么 ---------- */
  function todayMenu(state) {
    const week = state.week;
    if (!week || !week.length) return null;
    const day = week[0];
    return ['早', '午', '晚'].map(function (slot) {
      const m = day.meals[slot];
      if (!m) return null;
      const dish = D.DISHES.filter(d => d.id === m.id)[0];
      if (!dish) return null;
      return { slot: slot, dish: dish, missing: !!m.missing };
    }).filter(Boolean);
  }

  /* ---------- 搜索 ---------- */
  function search(q, foods) {
    q = (q || '').trim();
    if (!q) return { dishes: [], foods: [] };
    const dishes = D.DISHES.filter(function (d) {
      return d.name.indexOf(q) >= 0
        || d.ingredients.some(i => i.name.indexOf(q) >= 0)
        || d.cuisine.some(c => c.indexOf(q) >= 0)
        || d.tags.some(t => t.indexOf(q) >= 0);
    });
    const hits = foods.filter(f => f.name.indexOf(q) >= 0 || (f.cat || '').indexOf(q) >= 0);
    return { dishes: dishes, foods: hits };
  }

  /* ---------- 视频 ---------- */
  function videoEmbed(bvid) {
    return 'https://player.bilibili.com/player.html?bvid=' + bvid
      + '&autoplay=0&danmaku=0&high_quality=1&muted=0';
  }
  function videoPage(bvid) { return 'https://www.bilibili.com/video/' + bvid; }
  function videoSearch(platformKey, keyword) {
    const p = D.PLATFORM_MAP[platformKey];
    return p ? p.search(keyword + ' 做法') : '#';
  }

  /* ---------- 统计 ---------- */
  function summary(state) {
    const foods = state.foods;
    const c = counts(foods);
    const saved = (state.stats && state.stats.saved) || 0;
    const cooked = (state.stats && state.stats.cooked) || 0;
    return { counts: c, total: foods.length, saved: saved, cooked: cooked };
  }

  w.DD_ENGINE = {
    now, tier, daysLeft, counts, TIERS, TIER_RULES, TIER_WEIGHT,
    fmtQty, dayText, dateLabel,
    byName, findFood, foodMeta,
    pairList, topSuggestion, urgentList,
    ingredientState, cookable, nearMiss, dishScore, cook,
    planWeek, partyPlan, todayMenu, search, summary, parseTaste,
    videoEmbed, videoPage, videoSearch
  };
})(window);
