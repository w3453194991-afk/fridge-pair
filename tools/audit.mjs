/* 自查：数据一致性 + 边界情况 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sb = { console };
sb.window = sb;
sb.localStorage = { getItem() { return null; }, setItem() { }, removeItem() { } };
vm.createContext(sb);
for (const f of ['data.js', 'engine.js', 'store.js']) {
  vm.runInContext(readFileSync('E:/deepseek/fridge-pair/js/' + f, 'utf8'), sb, { filename: f });
}
const D = sb.DD_DATA, E = sb.DD_ENGINE, S = sb.DD_STORE;
S.load();
S.demoFamily();
const st = S.state;

const out = [];
const bad = (label, arr) => out.push([label, arr.length ? arr.slice(0, 8) : 'OK']);

/* 1. 菜品数据完整性 */
bad('菜谱缺食材', D.DISHES.filter(d => d.ingredients.some(i => !D.FOOD_MAP[i.name])).map(d => d.name));
bad('菜谱营养为 0', D.DISHES.filter(d => E.dishNutrition(d).kcal <= 0).map(d => d.name));
bad('菜谱没角色', D.DISHES.filter(d => !d.role).map(d => d.name));
bad('菜谱没菜系', D.DISHES.filter(d => !d.cuisine || !d.cuisine.length).map(d => d.name));
bad('菜谱时长为 0', D.DISHES.filter(d => !d.minutes).map(d => d.name));

/* 2. 数量与单位是否合理（g 类菜品用量过小、个类用量过大） */
const unitIssues = [];
D.DISHES.forEach(d => d.ingredients.forEach(i => {
  const m = D.FOOD_MAP[i.name];
  if (!m) return;
  if (m.unit === 'g' && i.qty < 20) unitIssues.push(d.name + '→' + i.name + ' ' + i.qty + 'g');
  if (m.unit === '个' && i.qty > 10) unitIssues.push(d.name + '→' + i.name + ' ' + i.qty + '个');
  if (m.unit === '枚' && i.qty > 10) unitIssues.push(d.name + '→' + i.name + ' ' + i.qty + '枚');
}));
bad('用量异常', unitIssues);

/* 3. 价格合理性（单价超过 200 元的食材） */
bad('单价异常高', D.FOOD_DB.filter(f => f.price > 200).map(f => f.name + ' ¥' + f.price));
bad('单价为 0', D.FOOD_DB.filter(f => !f.price || f.price <= 0).map(f => f.name));

/* 4. 过敏原覆盖 */
const allergyMap = {};
D.DISHES.forEach(d => E.allergensOf(d).forEach(a => { allergyMap[a] = (allergyMap[a] || 0) + 1; }));
out.push(['过敏原分布', allergyMap]);

/* 5. 边界：空冰箱 */
const emptyState = { foods: [], family: st.family, stats: {}, week: null };
let crash = [];
try {
  E.planWeek(emptyState);
  E.partyPlan(emptyState, { men: 2, women: 2, kids: 0 });
  E.assistant('今晚吃什么', emptyState);
  E.cookable([]); E.nearMiss([]); E.urgentList([]);
  E.smartSearch('鱼香茄子', []);
  E.weeklyReport(emptyState);
  E.zones([]);
} catch (e) { crash.push(e.message); }
bad('空冰箱崩溃', crash);

/* 6. 边界：0 人聚餐 */
try { E.partyPlan(st, { men: 0, women: 0, kids: 0 }); } catch (e) { crash.push('0人:' + e.message); }
bad('0 人聚餐崩溃', crash);

/* 7. 边界：奇怪输入 */
const weird = ['', '   ', '🐟', 'a'.repeat(50), '红烧', '汤', '怎么做', '我对', '预算', '请人'];
const weirdFail = [];
weird.forEach(q => {
  try {
    const r = E.assistant(q, st);
    if (!r || !r.reply) weirdFail.push(q + ' → 空回复');
  } catch (e) { weirdFail.push(q + ' → ' + e.message); }
});
bad('怪异输入', weirdFail);

/* 8. 一周菜单在食材很少时是否会崩 */
const thin = { foods: st.foods.slice(0, 2), family: st.family, stats: {}, week: null };
try {
  const w = E.planWeek(thin);
  const emptyMeals = w.reduce((n, d) => n + Object.values(d.meals).filter(m => !m.ids || !m.ids.length).length, 0);
  out.push(['极少食材时空餐次数', emptyMeals]);
} catch (e) { out.push(['极少食材崩溃', e.message]); }

/* 9. 时间旅行到 +30 天后的状态 */
S.travel(30);
const future = E.counts(st.foods);
out.push(['+30 天后四色', future]);
out.push(['+30 天后临期建议', E.urgentList(st.foods).length]);
S.travel(-30);

/* 10. 自定义菜谱流程 */
const custom = E.generateRecipe('香辣蟹');
const merged = JSON.parse(JSON.stringify(custom));
E.attachCustom([merged]);
out.push(['自定义菜谱可检索', D.DISHES.some(d => d.name === '香辣蟹')]);
out.push(['自定义菜谱角色', merged.role]);
out.push(['自定义菜谱营养', E.dishNutrition(merged).kcal]);

/* 11. 搜索兜底 */
['鱼香肉丝', '宫保鸡丁', '西红柿炒鸡蛋', '可乐鸡翅'].forEach(q => {
  const r = E.smartSearch(q, st.foods);
  out.push(['搜索 ' + q, r.dishes.length + ' 道 / 猜:' + (r.guessed.join(',') || '-')]);
});

console.log('=== 自查结果 ===');
out.forEach(([k, v]) => console.log(String(k).padEnd(16), '→', typeof v === 'object' ? JSON.stringify(v) : v));
