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
    const sysKey = (state.family && state.family.system) || 'cn';
    const sys = D.SYSTEM_MAP[sysKey] || D.MEAL_SYSTEMS[0];
    const avoid = (state.family && state.family.avoid) || [];
    const conds = (state.family && state.family.conditions) || [];
    const foods = state.foods.slice();
    const virt = {};
    foods.forEach(f => { virt[f.name] = { qty: f.qty, tier: tier(f) }; });
    const usedAt = {};
    let usedToday = {};
    const days = [];

    function scoreDish(d, dayIdx) {
      let s = 0;
      d.ingredients.forEach(function (ing) {
        const v = virt[ing.name];
        if (!v) { s -= 6; return; }
        s += TIER_WEIGHT[v.tier] || 1;
        if (v.qty < ing.qty) s -= 8;
      });
      if (sys.bias && sys.bias.length) {
        if (d.cuisine.some(c => sys.bias.indexOf(c) >= 0)) s += 10;
        else s -= 4;
      }
      if (usedAt[d.id] !== undefined) s -= 9; else s += 2;
      if (usedAt[d.id] === dayIdx) s -= 22;      // 同一天内不重复
      if (usedAt[d.id] === dayIdx - 1) s -= 12;  // 相邻两天也尽量不重复
      s += conditionPenalty(d, conds);
      return s + Math.random() * 9;
    }

    for (let i = 0; i < 7; i++) {
      const dt = new Date(now() + i * DAY);
      usedToday = {};
      const day = {
        idx: i,
        label: i === 0 ? '今天' : (i === 1 ? '明天' : WD[dt.getDay()]),
        date: (dt.getMonth() + 1) + '/' + dt.getDate(),
        meals: {}, notes: [], system: sys.key
      };

      ['早', '午', '晚'].forEach(function (slot) {
        const roles = sys.slots[slot] || ['荤菜'];
        const usedThisMeal = {};
        const ids = [];
        let missing = false;

        roles.forEach(function (role) {
          let cands = D.DISHES.filter(d => d.role === role && d.meals.indexOf(slot) >= 0 && dishAllowed(d, avoid) && !usedThisMeal[d.id]);
          if (!cands.length) cands = D.DISHES.filter(d => d.role === role && dishAllowed(d, avoid) && !usedThisMeal[d.id]);
          if (!cands.length) cands = D.DISHES.filter(d => d.meals.indexOf(slot) >= 0 && dishAllowed(d, avoid) && !usedThisMeal[d.id]);
          if (!cands.length) return;

          let best = null, bestScore = -1e9;
          cands.forEach(function (d) {
            const sc = scoreDish(d, i);
            if (sc > bestScore) { bestScore = sc; best = d; }
          });
          if (!best) return;

          ids.push(best.id);
          usedThisMeal[best.id] = 1;
          usedToday[best.id] = 1;
          usedAt[best.id] = i;
          best.ingredients.forEach(function (ing) {
            const v = virt[ing.name];
            if (!v) { missing = true; return; }
            if (v.qty < ing.qty) missing = true;
            v.qty = Math.max(0, v.qty - ing.qty);
          });
        });

        day.meals[slot] = { ids: ids, id: ids[0], missing: missing };
      });

      const allIds = [];
      Object.keys(day.meals).forEach(k => { allIds.push.apply(allIds, day.meals[k].ids || []); });
      const ds = allIds.map(id => D.DISHES.filter(d => d.id === id)[0]).filter(Boolean);
      const tagSet = {};
      ds.forEach(d => (d.tags || []).forEach(t => { tagSet[t] = (tagSet[t] || 0) + 1; }));
      const order = ['补铁', '补钙', '高蛋白', '清淡', '孩子爱吃', '老人友好', '幼儿', '控糖', '低脂', 'Omega-3', '下饭', '快手'];
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
    // 每道菜给一个随机扰动，并把上一桌的菜降权，保证每次排出来不一样
    const jitter = {};
    D.DISHES.forEach(function (d) { jitter[d.id] = Math.random() * 12; });
    const exclude = opts.exclude || [];

    const sorted = D.DISHES.slice()
      .filter(d => dishAllowed(d, opts.avoid))
      .filter(d => conditionPenalty(d, opts.conditions) > -100)
      .sort(function (a, b) {
        const ca = cuisine && a.cuisine.indexOf(cuisine) >= 0 ? 1 : 0;
        const cb = cuisine && b.cuisine.indexOf(cuisine) >= 0 ? 1 : 0;
        if (ca !== cb) return cb - ca;
        const ka = dishScore(a, foods) + jitter[a.id] - (exclude.indexOf(a.id) >= 0 ? 30 : 0);
        const kb = dishScore(b, foods) + jitter[b.id] - (exclude.indexOf(b.id) >= 0 ? 30 : 0);
        return kb - ka;
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
    const scale = Math.max(1, portions / 3);
    function missingOf(list) {
      const mm = {};
      list.forEach(d => ingredientState(d, foods).forEach(s => {
        if (s.ok) return;
        const need = Math.max(0, s.qty - s.haveQty);
        if (!mm[s.name]) {
          const m = foodMeta(s.name);
          mm[s.name] = { name: s.name, emoji: m.emoji, unit: m.unit, qty: 0, price: m.price || 0 };
        }
        mm[s.name].qty += need;
      }));
      return Object.keys(mm).map(k => {
        const m = mm[k];
        m.qty = Math.ceil(m.qty * scale * 10) / 10;
        m.cost = Math.round(m.qty * m.price * 10) / 10;
        return m;
      });
    }
    let missing = missingOf(picked);
    let totalCost = missing.reduce((s, m) => s + m.cost, 0);

    // 预算约束：超了就去掉最贵的那道
    const budget = opts.budget > 0 ? opts.budget : 0;
    const dropped = [];
    if (budget) {
      let guard = 0;
      while (totalCost > budget && picked.length > 3 && guard++ < 6) {
        let worst = 0, worstCost = -1;
        picked.forEach(function (d, i) {
          const c = ingredientState(d, foods).filter(s => !s.ok)
            .reduce((s, x) => s + Math.max(0, x.qty - x.haveQty) * (foodMeta(x.name).price || 0), 0);
          if (c > worstCost) { worstCost = c; worst = i; }
        });
        if (worstCost <= 0) break;
        dropped.push(picked[worst]);
        picked.splice(worst, 1);
        missing = missingOf(picked);
        totalCost = missing.reduce((s, m) => s + m.cost, 0);
      }
    }

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
      budget: budget, totalCost: Math.round(totalCost * 10) / 10,
      overBudget: !!(budget && totalCost > budget),
      dropped: dropped.map(d => d.name),
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
      return { slot: slot, dish: dish, ids: m.ids || [m.id], missing: !!m.missing };
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
    return p ? p.search(keyword) : '#';
  }

  /* ============================================================
     营养核算 / 过敏原 / 替换 / 对话助手
     ============================================================ */
  const NUT_KEYS = [
    { k: 'kcal', label: '热量', short: '热量', unit: 'kcal' },
    { k: 'p', label: '蛋白质', short: '蛋白', unit: 'g' },
    { k: 'ca', label: '钙', short: '钙', unit: 'mg' },
    { k: 'fe', label: '铁', short: '铁', unit: 'mg' },
    { k: 'vc', label: '维C', short: '维C', unit: 'mg' }
  ];

  // 一道菜（按菜谱给的量，约 2~3 人份）的营养合计
  function dishNutrition(dish) {
    const t = { kcal: 0, p: 0, ca: 0, fe: 0, vc: 0 };
    dish.ingredients.forEach(function (ing) {
      const m = foodMeta(ing.name);
      const n = m.nut || { kcal: 40, p: 2, ca: 20, fe: 0.5, vc: 10 };
      t.kcal += n.kcal * ing.qty;
      t.p += n.p * ing.qty;
      t.ca += n.ca * ing.qty;
      t.fe += n.fe * ing.qty;
      t.vc += n.vc * ing.qty;
    });
    Object.keys(t).forEach(k => { t[k] = Math.round(t[k] * 10) / 10; });
    return t;
  }

  // 每人份
  function dishNutritionPerServing(dish) {
    const t = dishNutrition(dish);
    const out = {};
    Object.keys(t).forEach(k => { out[k] = Math.round(t[k] / 2.5 * 10) / 10; });
    return out;
  }

  // 家庭每日目标：按成员角色加权
  const BASE_TARGET = { kcal: 2000, p: 60, ca: 800, fe: 15, vc: 100 };
  const ROLE_FACTOR = {
    '成人': { kcal: 1, p: 1, ca: 1, fe: 1, vc: 1 },
    '老人': { kcal: 0.9, p: 0.95, ca: 1.25, fe: 0.85, vc: 1 },
    '幼儿': { kcal: 0.6, p: 0.6, ca: 0.75, fe: 0.6, vc: 0.6 }
  };
  function dailyTarget(family) {
    const t = { kcal: 0, p: 0, ca: 0, fe: 0, vc: 0 };
    const members = (family && family.members) || [];
    if (!members.length) return Object.assign({}, BASE_TARGET);
    members.forEach(function (m) {
      const f = ROLE_FACTOR[m.role] || ROLE_FACTOR['成人'];
      Object.keys(t).forEach(k => { t[k] += BASE_TARGET[k] * f[k]; });
    });
    Object.keys(t).forEach(k => { t[k] = Math.round(t[k]); });
    return t;
  }

  // 三餐合计 vs 目标
  function dayNutrition(dishes) {
    const t = { kcal: 0, p: 0, ca: 0, fe: 0, vc: 0 };
    dishes.forEach(function (d) {
      if (!d) return;
      const n = dishNutritionPerServing(d);
      Object.keys(t).forEach(k => { t[k] += n[k]; });
    });
    Object.keys(t).forEach(k => { t[k] = Math.round(t[k] * 10) / 10; });
    return t;
  }

  // 一餐 = 一道菜（每人份）+ 一碗主食的基线
  const STAPLE = { kcal: 230, p: 6, ca: 8, fe: 0.6, vc: 0 };
  function mealNutrition(dish) {
    const n = dishNutritionPerServing(dish);
    const out = {};
    Object.keys(n).forEach(function (k) { out[k] = Math.round((n[k] + (STAPLE[k] || 0)) * 10) / 10; });
    return out;
  }

  // 每人每餐目标 = 全家日目标 / 人数 / 3
  function perMealTarget(family) {
    const t = dailyTarget(family);
    const n = Math.max(1, ((family && family.members) || []).length);
    const out = {};
    Object.keys(t).forEach(function (k) { out[k] = Math.round(t[k] / n / 3 * 10) / 10; });
    return out;
  }

  function nutritionBars(totals, target) {
    return NUT_KEYS.map(function (k) {
      const got = totals[k.k] || 0;
      const need = target[k.k] || 1;
      return { key: k.k, label: k.label, short: k.short, unit: k.unit, got: Math.round(got), need: need, pct: Math.min(150, Math.round(got / need * 100)) };
    });
  }

  /* ---------- 过敏原 ---------- */
  function allergensOf(dish) {
    const set = {};
    dish.ingredients.forEach(function (i) {
      const f = foodMeta(i.name);
      if (f.allergen) set[f.allergen] = 1;
    });
    return Object.keys(set);
  }
  function dishAllowed(dish, avoid) {
    if (!avoid || !avoid.length) return true;
    const has = allergensOf(dish);
    return !has.some(a => avoid.indexOf(a) >= 0);
  }

  /* ---------- 食材替换 ---------- */
  function substitutesFor(name) {
    return (D.SUBSTITUTES[name] || []).filter(n => D.FOOD_MAP[n]);
  }

  /* ---------- 冰箱分区 ---------- */
  function zones(foods) {
    const order = ['冷藏', '冷冻', '常温', '阴凉'];
    const map = {};
    order.forEach(z => { map[z] = []; });
    foods.forEach(function (f) {
      const z = order.indexOf(f.storage) >= 0 ? f.storage : '冷藏';
      map[z].push(f);
    });
    return order.filter(z => map[z].length).map(z => ({ zone: z, items: map[z] }));
  }

  /* ---------- 对话助手（规则解析） ---------- */
  function assistant(q, state) {
    const text = String(q || '').trim();
    const foods = state.foods;
    const c = counts(foods);
    if (!text) {
      return { reply: '可以问我：今晚吃什么 / 什么快坏了 / 冰箱还有啥 / 买什么 / 怎么做番茄炒蛋', chips: defaultChips() };
    }

    // 先看是不是「让 AI 改设置」的指令（过敏原 / 疾病史 / 体系 / 置顶 / 入库…）
    const cmd = parseCommand(text, state);
    if (cmd) {
      return { reply: cmd.say, chips: defaultChips(), action: cmd.op ? { op: cmd.op, value: cmd.value } : null };
    }

    // 怎么做 X / 菜谱
    const dishHit = D.DISHES.filter(d => text.indexOf(d.name) >= 0)[0]
      || D.DISHES.filter(d => d.name.indexOf(text.replace(/怎么做|咋做|做法|教程|菜谱/g, '').trim()) >= 0)[0];
    if (dishHit) {
      const st = ingredientState(dishHit, foods);
      const miss = st.filter(s => !s.ok);
      return {
        reply: dishHit.name + '：' + dishHit.minutes + ' 分钟，' + dishHit.ingredients.map(i => i.name).join(' + ')
          + (miss.length ? '。还差 ' + miss.map(m => m.name).join('、') : '。食材齐了，现在就能做。'),
        chips: [
          { label: '打开教程', dish: dishHit.id },
          miss.length ? { label: '把缺的加进采购', addCart: dishHit.id } : null
        ].filter(Boolean)
      };
    }

    // 今晚吃什么 / 今天吃什么
    if (/吃什么|晚饭|晚饭吃啥|今晚|菜单/.test(text)) {
      const t = todayMenu(state);
      if (t && t.length) {
        return {
          reply: '今晚按家里档案排的是：' + t.map(x => x.slot + '·' + x.dish.name).join('，') + '。',
          chips: [{ label: '看一周菜单', view: 'week' }, { label: '换一换', action: 'genWeek' }]
        };
      }
      const sug = topSuggestion(foods, 0);
      return {
        reply: '还没排菜单。要不先做「' + (sug ? sug.a + '＋' + sug.b : '番茄炒蛋') + '」？',
        chips: [{ label: '生成一周菜单', action: 'genWeek' }]
      };
    }

    // 快坏了 / 临期
    if (/快坏|临期|过期|先吃|要坏/.test(text)) {
      const u = urgentList(foods);
      const bad = foods.filter(f => tier(f) === 'b');
      return {
        reply: u.length
          ? '今天该吃的 ' + u.length + ' 样：' + u.map(f => f.name + '(' + dayText(f) + ')').join('、')
          : (bad.length ? '没有临期的，但有 ' + bad.length + ' 件已过期，建议清理。' : '冰箱状态很好，没有临期的。'),
        chips: u.length ? [{ label: '看临期菜单', action: 'genMenu' }] : [{ label: '清理过期', action: 'cleanExpired' }]
      };
    }

    // 还剩什么 / 冰箱有啥
    if (/还剩|有什么|有啥|库存|冰箱里/.test(text)) {
      const g = foods.filter(f => tier(f) === 'g').length;
      return {
        reply: '冰箱共 ' + foods.length + ' 件：充足 ' + c.g + '、正常 ' + c.y + '、临期 ' + c.p + '、过期 ' + c.b
          + '。最近要优先处理的是：' + (urgentList(foods).slice(0, 3).map(f => f.name).join('、') || '暂无'),
        chips: [{ label: '打开冰箱', view: 'fridge' }, { label: '拍照入库', action: 'shoot' }]
      };
    }

    // 买什么 / 缺什么
    if (/买什么|缺什么|采购|补货|购物/.test(text)) {
      const near = nearMiss(foods).slice(0, 3);
      return {
        reply: near.length
          ? '补这几样就能多做 ' + near.length + ' 道菜：' + near.map(n => n.need.name + '（可做' + n.dish.name + '）').join('、')
          : '现在菜品都能做，采购清单是空的。想聚餐的话可以去「聚餐规划」排一桌。',
        chips: [{ label: '看配餐', view: 'plan' }]
      };
    }

    // 浪费 / 周报
    if (/浪费|节约|省了|报告|周报|统计/.test(text)) {
      const r = weeklyReport(state);
      return {
        reply: '做菜 ' + r.cooked + ' 顿，挽回约 ¥' + r.saved.toFixed(1) + '，清理 ' + r.trashed
          + ' 件，浪费率 ' + r.wasteRate + '%。',
        chips: [{ label: '看本周报告', view: 'report' }]
      };
    }

    // 营养
    if (/营养|健康|热量|蛋白|补钙|补铁/.test(text)) {
      const t = dailyTarget(state.family);
      const today = todayMenu(state);
      const ds = today ? today.map(x => x.dish) : [];
      const n = dayNutrition(ds);
      return {
        reply: '全家每日目标约 ' + t.kcal + ' kcal / 蛋白 ' + t.p + ' g / 钙 ' + t.ca + ' mg。'
          + (today ? '今天三餐合计约 ' + n.kcal + ' kcal、蛋白 ' + n.p + ' g。' : '还没排菜单，生成后能看每日达标率。'),
        chips: [{ label: '看营养面板', view: 'week' }]
      };
    }

    // 指令：让 AI 直接改设置（已在上方处理，这里保留兜底）
    // 兜底：搜索
    const res = search(text, foods);
    return {
      reply: res.dishes.length
        ? '找到 ' + res.dishes.length + ' 道相关菜：' + res.dishes.slice(0, 3).map(d => d.name).join('、')
        : '没找到「' + text + '」。可以试试菜名、食材，或者问我「今晚吃什么」。',
      chips: res.dishes.length ? [{ label: '打开「' + res.dishes[0].name + '」', dish: res.dishes[0].id }] : defaultChips()
    };
  }

  function defaultChips() {
    return [
      { label: '今晚吃什么', ask: '今晚吃什么' },
      { label: '什么快坏了', ask: '什么快坏了' },
      { label: '冰箱里还有啥', ask: '冰箱里还有啥' },
      { label: '该买什么', ask: '该买什么' }
    ];
  }

  /* ---------- 周报 ---------- */
  function weeklyReport(state) {
    const foods = state.foods;
    const c = counts(foods);
    const bad = foods.filter(f => tier(f) === 'b');
    const urgent = urgentList(foods);
    const cooked = (state.stats && state.stats.cooked) || 0;
    const saved = (state.stats && state.stats.saved) || 0;
    const trashed = (state.stats && state.stats.trashed) || 0;
    const wasteRate = (cooked + trashed) ? Math.round(trashed / (cooked + trashed) * 100) : 0;
    const tips = [];
    if (bad.length) tips.push('有 ' + bad.length + ' 件已经过期，下次别一次囤这么多');
    if (urgent.length > 2) tips.push('临期 ' + urgent.length + ' 件，建议生日两次采购，别一次性买满');
    if (!tips.length) tips.push('这周几乎没浪费，保持住');
    return {
      cooked: cooked, saved: Math.round(saved * 10) / 10, trashed: trashed,
      wasteRate: wasteRate, counts: c,
      urgent: urgent.map(f => f.name),
      tips: tips
    };
  }

  /* ---------- 智能搜索：别名归一 + 菜名里抽食材 ---------- */
  function normalizeQuery(q) {
    let s = String(q || '').trim();
    Object.keys(D.FOOD_ALIAS).forEach(function (k) {
      if (k.length >= 2 && s.indexOf(k) >= 0) s = s.split(k).join(D.FOOD_ALIAS[k]);
    });
    return s;
  }

  function guessFoods(q) {
    const s = normalizeQuery(q);
    let stripped = s;
    D.COOK_WORDS.forEach(function (w) { stripped = stripped.split(w).join(' '); });
    const hits = [];
    D.FOOD_DB.map(f => f.name).sort((a, b) => b.length - a.length).forEach(function (n) {
      if ((s.indexOf(n) >= 0 || stripped.indexOf(n) >= 0) && hits.indexOf(n) < 0) hits.push(n);
    });
    return hits;
  }

  function smartSearch(q, foods) {
    const raw = String(q || '').trim();
    const norm = normalizeQuery(raw);
    const direct = search(norm, foods);
    const guessed = guessFoods(raw);
    let suggestion = [];
    let dishes = direct.dishes;
    let byIngredient = false;

    // 整道菜搜不到时，退一步：用抽出的食材做"全部命中"匹配
    if (!dishes.length && guessed.length >= 2) {
      const all = D.DISHES.filter(function (d) {
        return guessed.every(function (g) {
          return d.ingredients.some(function (i) { return i.name === g; });
        });
      });
      if (all.length) {
        dishes = all.sort(function (a, b) {
          const ca = ingredientState(a, foods).every(s => s.ok) ? 1 : 0;
          const cb = ingredientState(b, foods).every(s => s.ok) ? 1 : 0;
          return cb - ca;
        });
        byIngredient = true;
      }
    }

    if (!dishes.length && guessed.length) {
      suggestion = D.DISHES.filter(function (d) {
        return d.ingredients.some(function (i) { return guessed.indexOf(i.name) >= 0; });
      }).sort(function (a, b) {
        const ca = ingredientState(a, foods).every(s => s.ok) ? 1 : 0;
        const cb = ingredientState(b, foods).every(s => s.ok) ? 1 : 0;
        if (ca !== cb) return cb - ca;
        const ha = a.ingredients.filter(i => guessed.indexOf(i.name) >= 0).length;
        const hb = b.ingredients.filter(i => guessed.indexOf(i.name) >= 0).length;
        return hb - ha;
      }).slice(0, 6);
    }

    return {
      raw: raw, norm: norm, dishes: dishes, foods: direct.foods,
      guessed: guessed, suggestion: suggestion, byIngredient: byIngredient,
      changed: norm !== raw
    };
  }

  /* ============================================================
     指令解析：让 AI 能"操作界面"
     返回 { op, value, say } —— say 是给用户的确认语
     ============================================================ */
  const ALLERGY_SYN = {
    海鲜: ['海鲜', '虾', '蟹', '贝类', '鱼'],
    乳: ['乳制品', '乳', '牛奶', '奶制品', '奶油'],
    蛋: ['鸡蛋', '蛋'],
    豆: ['豆制品', '大豆', '黄豆', '豆'],
    麸质: ['麸质', '小麦', '面粉', '面筋'],
    坚果: ['坚果', '花生', '核桃', '腰果', '杏仁']
  };
  const COND_SYN = {
    高血压: ['高血压', '血压高', '血压'],
    高血脂: ['高血脂', '血脂高', '血脂'],
    糖尿病: ['糖尿病', '血糖高', '血糖'],
    痛风: ['痛风', '尿酸'],
    肾病: ['肾病', '肾不好', '肾功能'],
    胃病: ['胃病', '胃不好', '胃疼', '胃炎']
  };
  const SYSTEM_SYN = {
    west: ['西餐', '西式'], jp: ['日式', '日本菜'], kr: ['韩式', '韩国菜'],
    sea: ['东南亚', '泰式', '泰国菜'], cn: ['中式', '中餐']
  };

  function pickEntity(text, dict) {
    for (const k in dict) {
      if (dict[k].some(function (w) { return text.indexOf(w) >= 0; })) return k;
    }
    return '';
  }

  function pickFood(text, foods) {
    const names = D.FOOD_DB.map(f => f.name).sort((a, b) => b.length - a.length);
    for (const n of names) if (text.indexOf(n) >= 0) return n;
    return '';
  }

  function parseCommand(text, state) {
    const t = String(text || '').trim();
    if (!t) return null;
    const neg = /不(要|用|加|吃|是)?|别|取消|去掉|没有/.test(t);

    /* 1. 过敏原 */
    if (/过敏/.test(t)) {
      const a = pickEntity(t, ALLERGY_SYN);
      if (a) {
        return {
          op: neg ? 'allergy.remove' : 'allergy.add',
          value: a,
          say: neg
            ? '好，已经把「' + a + '」从过敏原里去掉。'
            : '记下了：你对「' + a + '」过敏，已写进健康档案，之后排餐会避开含' + a + '的菜。'
        };
      }
      if (neg) return { op: null, say: '好的，那就不加过敏原。' };
      return { op: 'nav', value: 'health', say: '我帮你打开健康档案，你在里面勾选具体的过敏原就行。' };
    }

    /* 2. 疾病史 */
    {
      const c = pickEntity(t, COND_SYN);
      if (c && /有|患|是|得|没|没有|取消|去掉/.test(t)) {
        return {
          op: neg ? 'condition.remove' : 'condition.add',
          value: c,
          say: neg
            ? '好，已把「' + c + '」从疾病史里去掉。'
            : '记下了：家里有「' + c + '」，之后排餐会自动避开相关食材（' + (D.CONDITION_MAP[c] ? D.CONDITION_MAP[c].note : '') + '）。'
        };
      }
    }

    /* 3. 餐饮体系 */
    if (/换成|改成|这周|以后|都吃|想吃/.test(t)) {
      const s = pickEntity(t, SYSTEM_SYN);
      if (s) {
        const nm = D.SYSTEM_MAP[s] ? D.SYSTEM_MAP[s].name : s;
        return { op: 'system', value: s, say: '好的，餐饮体系切换成「' + nm + '」，重新生成一周菜单就会按这套结构排。' };
      }
    }

    /* 4. 置顶 */
    if (/置顶|顶上去|排前面/.test(t)) {
      const d = D.DISHES.filter(x => t.indexOf(x.name) >= 0)[0];
      if (d) return { op: 'pin', value: d.id, say: '已经把「' + d.name + '」置顶到菜谱最前面。' };
    }

    /* 5. 采购 */
    if (/采购|清单|补货/.test(t) && !/买了|刚买/.test(t)) {
      return { op: 'nav', value: 'plan', say: '我打开配餐页，采购清单在下面，缺什么一目了然。' };
    }

    /* 6. 入库 / 吃掉 */
    if (/买了|刚买|入库|带回来/.test(t)) {
      const f = pickFood(t, state.foods);
      if (f) {
        const m = t.match(/(\d+)\s*(个|颗|根|把|盒|袋|枚|斤|克|g|kg)/);
        let qty = m ? parseFloat(m[1]) : 1;
        if (m && m[2] === '斤') qty = qty * 500;
        if (m && (m[2] === '克' || m[2] === 'g')) qty = qty;
        const meta = foodMeta(f);
        if (meta.unit === 'g' && qty <= 20) qty = qty * 500;
        return { op: 'food.add', value: { name: f, qty: Math.max(1, qty) }, say: '已入库：' + f + ' ' + fmtQty(qty) + ' ' + meta.unit + '（按标准保质期算）。' };
      }
    }
    if (/吃完|吃掉|用完了|没了/.test(t)) {
      const f = pickFood(t, state.foods);
      if (f) return { op: 'food.consume', value: f, say: '好，' + f + ' 已标记吃完，库存清掉了。' };
    }

    /* 7. 预算 */
    {
      const b = t.match(/预算[^\d]{0,4}(\d{2,5})/);
      if (b) return { op: 'budget', value: parseInt(b[1], 10), say: '聚餐预算设为 ¥' + b[1] + '，超了会自动换掉最贵的菜。' };
    }

    /* 8. 聚餐 */
    if (/聚餐|请客|请.{0,2}人|来.{0,3}人|朋友来|吃饭.{0,4}人/.test(t)) {
      const p = t.match(/(\d+)\s*(个|位)?\s*人/);
      const cu = pickCuisine(t);
      const dateKey = /周五/.test(t) ? 'fri' : /周六/.test(t) ? 'sat' : /明天/.test(t) ? 'tomorrow' : /今天/.test(t) ? 'today' : '';
      const parts = [];
      if (p) parts.push(parseInt(p[1], 10) + ' 人');
      if (cu) parts.push(cu);
      if (dateKey) parts.push({ fri: '本周五', sat: '本周六', today: '今天', tomorrow: '明天' }[dateKey]);
      return {
        op: 'party',
        value: { people: p ? parseInt(p[1], 10) : 4, cuisine: cu || '', dateKey: dateKey || '' },
        say: '好的，按' + (parts.join(' · ') || '默认 4 人') + '帮你排一桌，已经排好了。'
      };
    }

    /* 9. 主题 / 导航 */
    if (/深色|夜间模式|黑一点/.test(t)) return { op: 'theme', value: 'dark', say: '已切到深色模式。' };
    if (/浅色|白天模式|亮一点/.test(t)) return { op: 'theme', value: 'light', say: '已切回浅色模式。' };

    if (/打开|看看|看一下|去/.test(t)) {
      const navMap = [
        [/超市|买菜|附近/, 'nearby', '附近超市'],
        [/健康|过敏|疾病/, 'health', '健康档案'],
        [/报告|周报|统计/, 'report', '每周报告'],
        [/冰箱|库存/, 'fridge', '冰箱'],
        [/配餐|菜单|食谱/, 'plan', '配餐'],
        [/菜谱|做菜/, 'recipe', '菜谱']
      ];
      for (const it of navMap) {
        if (it[0].test(t)) return { op: 'nav', value: it[1], say: '好的，打开' + it[2] + '。' };
      }
    }

    return null;
  }

  function pickCuisine(t) {
    const map = { 川菜: ['川菜', '麻辣', '四川'], 粤菜: ['粤菜', '广东'], 江浙: ['江浙', '杭帮', '上海菜'],
      鲁菜: ['鲁菜', '山东'], 湘菜: ['湘菜', '湖南'], 东北: ['东北'], 西北: ['西北', '新疆'],
      西餐: ['西餐', '西式'], 日韩: ['日式', '韩式', '日本', '韩国'], 东南亚: ['东南亚', '泰式', '咖喱'] };
    for (const k in map) if (map[k].some(w => t.indexOf(w) >= 0)) return k;
    return '';
  }

  /* ============================================================
     自定义菜谱：按菜名生成一份可用的做法
     ============================================================ */
  const NAME_FRAG = {
    肉丝: '猪里脊', 肉片: '猪里脊', 肉末: '猪肉馅', 肉馅: '猪肉馅', 里脊: '猪里脊',
    鸡丁: '鸡胸肉', 鸡块: '鸡腿', 鸡翅: '鸡翅', 鸡腿: '鸡腿',
    鱼片: '草鱼', 鱼头: '鲈鱼', 鱼: '鲈鱼', 虾仁: '虾仁', 虾: '虾',
    排骨: '排骨', 牛腩: '牛腩', 牛肉: '牛里脊', 羊肉: '羊肉', 豆腐: '豆腐',
    蟹: '螃蟹', 贝: '扇贝', 蚝: '生蚝', 蛤: '蛤蜊', 螺: '蛤蜊', 菇: '香菇', 笋: '竹笋',
    茄子: '茄子', 土豆: '土豆', 番茄: '番茄', 西红柿: '番茄', 鸡蛋: '鸡蛋', 蛋: '鸡蛋',
    白菜: '大白菜', 菠菜: '菠菜', 豆角: '豆角', 藕: '莲藕', 香菇: '香菇', 蘑菇: '香菇',
    黄瓜: '黄瓜', 冬瓜: '冬瓜', 南瓜: '南瓜', 青椒: '青椒', 芹菜: '芹菜', 韭菜: '韭菜'
  };

  const METHOD_TPL = {
    红烧: {
      cuisine: ['家常'], minutes: 45, level: '进阶', tag: '下饭',
      season: ['生抽 20 ml', '老抽 5 ml', '冰糖 10 g', '料酒 15 ml', '姜 3 片'],
      prep: ['{main}处理干净，切大小均匀的块。'],
      steps: [
        { heat: '中火', text: '{main}先煎到表面微黄，盛出备用。' },
        { heat: '中火', text: '下冰糖炒出糖色，倒回{main}裹匀，加生抽、老抽、料酒和姜片。' },
        { heat: '小火', text: '加热水没过，小火焖 25 分钟。' },
        { heat: '大火', text: '开盖大火收汁，收到汤汁浓稠挂勺即可。' }
      ],
      tips: ['收汁时勤翻动，糖分容易糊底。', '加热水不加冷水，肉才不柴。']
    },
    清蒸: {
      cuisine: ['粤菜'], minutes: 20, level: '新手', tag: '零油烟',
      season: ['蒸鱼豉油 20 ml', '姜 4 片', '葱 2 段', '料酒 10 ml', '食用油 10 ml'],
      prep: ['{main}洗净，表面划几刀更入味。'],
      steps: [
        { heat: '大火', text: '{main}抹料酒和少许盐，铺姜片，水开后上锅。' },
        { heat: '大火', text: '大火蒸 8~10 分钟（按厚薄调整）。' },
        { heat: '关火', text: '倒掉盘中腥水，铺葱丝，淋蒸鱼豉油。' },
        { heat: '大火', text: '浇一勺烧到冒烟的热油激香。' }
      ],
      tips: ['一定要水开再上锅。', '蒸出来的水必须倒掉，那是腥味来源。']
    },
    汤: {
      cuisine: ['清淡'], minutes: 45, level: '新手', tag: '清淡',
      season: ['姜 3 片', '盐 3 g', '白胡椒 少许'],
      prep: ['{main}处理干净，切块。'],
      steps: [
        { heat: '大火', text: '{main}冷水下锅焯水，撇净浮沫。' },
        { heat: '小火', text: '加姜片和热水，小火煮 30 分钟。' },
        { heat: '中火', text: '加盐和其余配料，再煮 8 分钟。' },
        { heat: '关火', text: '撒白胡椒，起锅。' }
      ],
      tips: ['焯水冷水下锅，血沫才出得干净。', '盐最后放。']
    },
    凉拌: {
      cuisine: ['家常', '清淡'], minutes: 10, level: '新手', tag: '快手',
      season: ['蒜末 2 瓣', '生抽 10 ml', '香醋 8 ml', '香油 3 ml', '小米椒 1 个'],
      prep: ['{main}洗净切丝或切块。'],
      steps: [
        { heat: '大火', text: '{main}焯水 60 秒捞出过凉水，沥干。' },
        { heat: '无火', text: '蒜末、生抽、香醋、香油调成料汁。' },
        { heat: '无火', text: '浇在{main}上拌匀，冷藏 5 分钟更爽口。' }
      ],
      tips: ['焯水后过凉水，口感才脆。', '料汁最后拌，早了会出水。']
    },
    炸: {
      cuisine: ['家常'], minutes: 25, level: '进阶', tag: '解馋',
      season: ['淀粉 50 g', '盐 2 g', '料酒 10 ml', '油 400 ml'],
      prep: ['{main}切条，加盐和料酒腌 10 分钟。'],
      steps: [
        { heat: '中火', text: '{main}裹一层干淀粉。' },
        { heat: '中火', text: '六成油温下锅炸 2 分钟定型。' },
        { heat: '大火', text: '升高油温复炸 40 秒，外壳更脆。' },
        { heat: '关火', text: '捞出控油，撒椒盐。' }
      ],
      tips: ['复炸是脆的关键。', '油温六成热：筷子插入冒小泡。']
    },
    炒: {
      cuisine: ['家常'], minutes: 15, level: '新手', tag: '快手',
      season: ['生抽 10 ml', '盐 2 g', '蒜末 2 瓣', '食用油 15 ml'],
      prep: ['{main}切丝或切片，尽量大小一致。'],
      steps: [
        { heat: '大火', text: '锅烧热倒油，下蒜末爆香。' },
        { heat: '大火', text: '下{main}大火快炒 1 分半。' },
        { heat: '大火', text: '加生抽和盐翻匀。' },
        { heat: '关火', text: '尝一下咸淡，出锅装盘。' }
      ],
      tips: ['大火快炒才脆嫩。', '调料提前备好，炒起来没时间找。']
    }
  };

  function detectMethod(name) {
    const n = String(name || '');
    if (/红烧|糖醋|酱焖/.test(n)) return '红烧';
    if (/蒸/.test(n)) return '清蒸';
    if (/汤|羹|粥/.test(n)) return '汤';
    if (/凉拌|拌/.test(n)) return '凉拌';
    if (/炸|锅包|酥/.test(n)) return '炸';
    return '炒';
  }

  function guessMain(name) {
    const n = String(name || '');
    for (const k in NAME_FRAG) if (n.indexOf(k) >= 0) return NAME_FRAG[k];
    const names = D.FOOD_DB.map(f => f.name).sort((a, b) => b.length - a.length);
    for (const x of names) if (n.indexOf(x) >= 0) return x;
    return '';
  }

  function unitQty(food) {
    const u = (foodMeta(food).unit || '个');
    if (u === 'g') return 300;
    if (u === '枚') return 3;
    if (u === '朵') return 6;
    if (u === '片') return 4;
    if (u === '张') return 6;
    return 2;
  }

  // 生成一份菜谱草稿
  function generateRecipe(name, mainName) {
    const nm = String(name || '').trim();
    const main = mainName || guessMain(nm) || '五花肉';
    const m = detectMethod(nm);
    const tpl = METHOD_TPL[m] || METHOD_TPL['炒'];
    const meta = foodMeta(main);
    const isMeat = /肉|鱼|虾|蟹|鸡|鸭|牛|羊|猪/.test(main) || meta.cat === '肉类' || meta.cat === '水产';
    const fill = s => s.replace(/\{main\}/g, main);

    const ing = [{ name: main, qty: unitQty(main) }];
    // 配菜只在炒/红烧的猪牛鸡肉上加，鱼虾和鸡翅不加
    const companion = { 猪里脊: '青椒', 五花肉: '青椒', 牛里脊: '洋葱', 鸡胸肉: '青椒' }[main];
    if (companion && (m === '炒' || m === '红烧')) ing.push({ name: companion, qty: 1 });

    const d = {
      id: 'c-' + hashName(nm),
      name: nm,
      emoji: meta.emoji || '🍽',
      minutes: tpl.minutes,
      level: tpl.level,
      cuisine: tpl.cuisine.slice(),
      meals: ['午', '晚'],
      tags: [tpl.tag, '自定义'],
      ingredients: ing,
      seasonings: tpl.season.slice(),
      prep: tpl.prep.map(fill),
      steps: tpl.steps.map(s => ({ heat: s.heat, text: fill(s.text) })),
      tips: tpl.tips.slice(),
      nutrition: '按' + main + '为主要食材估算，营养值以食材折算为准。',
      pair: '自定义菜谱 · 可按口味调整',
      custom: true
    };

    // 鱼香：糖醋 + 泡椒，模板给不出来，单独写
    if (/鱼香/.test(nm)) {
      d.ingredients = [{ name: main, qty: unitQty(main) }, { name: '木耳', qty: 15 }, { name: '胡萝卜', qty: 1 }];
      d.seasonings = ['泡椒 2 个', '醋 15 ml', '白糖 12 g', '生抽 10 ml', '淀粉 5 g', '蒜末 3 瓣'];
      d.prep = [main + '切丝，加生抽和淀粉抓匀腌 10 分钟。', '木耳泡发切丝，胡萝卜切丝。'];
      d.steps = [
        { heat: '大火', text: '肉丝滑油变色，盛出备用。' },
        { heat: '大火', text: '炒香泡椒和蒜末，下木耳、胡萝卜丝炒 1 分钟。' },
        { heat: '大火', text: '倒回肉丝，淋糖醋汁大火收浓，翻匀出锅。' }
      ];
      d.tips = ['糖醋比例 1:1 是鱼香的关键。', '没有泡椒可以用一勺豆瓣酱代替。'];
      d.tags.push('鱼香');
      d.minutes = 20;
    }

    // 可乐：靠可乐里的糖收汁
    if (/可乐/.test(nm)) {
      d.seasonings = ['可乐 330 ml', '生抽 20 ml', '姜 3 片', '料酒 15 ml'];
      d.prep = [main + '洗净，两面各划两刀更入味。'];
      d.steps = [
        { heat: '中火', text: main + '两面煎到金黄。' },
        { heat: '中火', text: '加姜片、料酒、生抽，倒可乐没过' + main + '。' },
        { heat: '小火', text: '小火焖 15 分钟。' },
        { heat: '大火', text: '开盖大火收汁，收到浓稠发亮裹住' + main + '。' }
      ];
      d.tips = ['可乐本身有糖，不用另外放糖。', '收汁到能挂勺就关火，久了发苦。'];
      d.tags.push('可乐');
      d.minutes = 30;
    }

    return d;
  }

  function hashName(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // 把用户自定义的菜谱挂进主库
  function attachCustom(list) {
    (list || []).forEach(function (d) {
      if (!d || !d.id) return;
      if (D.DISHES.some(x => x.id === d.id)) return;
      d.cuisine = d.cuisine && d.cuisine.length ? d.cuisine : ['家常'];
      d.videos = d.videos || [];
      if (!d.role) {
        const ns = d.ingredients.map(i => i.name);
        const has = re => ns.some(n => re.test(n));
        d.role = /汤|羹|粥/.test(d.name) ? '汤羹'
          : has(/大米|挂面|面粉|馒头|面包|意面|粉丝|饺子皮|米线|河粉|乌冬|年糕|吐司|饼皮/) ? '主食'
            : has(/牛|羊|猪|鸡|鸭|鱼|虾|蟹|贝|肉|排骨|培根|香肠|火腿|鸡蛋|蛋/) ? '荤菜' : '素菜';
      }
      D.DISHES.push(d);
    });
  }

  /* ---------- 疾病史 ---------- */
  function conditionPenalty(dish, conds) {
    if (!conds || !conds.length) return 0;
    let p = 0;
    conds.forEach(function (k) {
      const c = D.CONDITION_MAP[k];
      if (!c) return;
      const hit = dish.ingredients.some(function (i) { return c.foods.indexOf(i.name) >= 0; });
      if (hit) p -= 1000;
      if (c.tags && c.tags.length && (dish.tags || []).some(function (t) { return c.tags.indexOf(t) >= 0; })) p -= 8;
      if (c.key === '糖尿病' && /糖醋|拔丝|蜜汁/.test(dish.name)) p -= 8;
      if (c.key === '胃病' && /辣|椒麻/.test(dish.name)) p -= 6;
    });
    return p;
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
    planWeek, partyPlan, todayMenu, search, smartSearch, normalizeQuery, guessFoods, summary, parseTaste,
    videoEmbed, videoPage, videoSearch,
    NUT_KEYS, dishNutrition, dishNutritionPerServing, dailyTarget, dayNutrition, nutritionBars,
    mealNutrition, perMealTarget,
    allergensOf, dishAllowed, conditionPenalty, substitutesFor, zones, assistant, weeklyReport,
    parseCommand, generateRecipe, guessMain, detectMethod, attachCustom
  };
})(window);
