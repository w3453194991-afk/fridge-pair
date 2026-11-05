/* 小程序核心冒烟测试：用假的 wx 环境加载 shim + 三个核心文件 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const store = {};
const wx = {
  getStorageSync: k => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: k => { delete store[k]; }
};

const sb = { console, wx, Math, Date, JSON, Object, Array, String, Number, parseInt, parseFloat, isNaN, RegExp, Error, setTimeout, module: { exports: {} } };
sb.globalThis = sb;
sb.exports = sb.module.exports;
vm.createContext(sb);

const load = f => vm.runInContext(readFileSync('E:/deepseek/fridge-pair/miniprogram/lib/' + f, 'utf8'), sb, { filename: f });
load('shim.js');
load('data.js');
load('engine.js');
load('store.js');

const D = sb.DD_DATA, E = sb.DD_ENGINE, S = sb.DD_STORE;
if (!D || !E || !S) { console.log('FAIL: 核心未挂载', !!D, !!E, !!S); process.exit(1); }

S.load();
if (!S.state.family.loggedIn) { S.demoFamily(); S.save(); }

const c = E.counts(S.state.foods);
const week = E.planWeek(S.state);
const cookable = E.cookable(S.state.foods);
const dish = D.DISHES[0];
const nu = E.dishNutrition(dish);

console.log(JSON.stringify({
  foods: S.state.foods.length,
  dishes: D.DISHES.length,
  fourColors: c,
  weekDays: week.length,
  firstDay: week[0].label,
  firstMeals: Object.keys(week[0].meals),
  cookable: cookable.length,
  sampleDish: dish.name,
  sampleKcal: nu.kcal,
  persisted: Object.keys(store).length > 0,
  storageKeys: Object.keys(store)
}, null, 1));

/* 模拟一次做菜扣库存 */
const target = cookable[0];
if (target) {
  const before = S.state.foods.length;
  const res = E.cook(target, S.state);
  S.save();
  const after = S.state.foods.length;
  console.log('cook:', target.name, '| 扣减', res.used.length, '项 | 食材数', before, '→', after);
}
