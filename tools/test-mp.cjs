/* 小程序核心冒烟测试：与小程序一致的 CommonJS require 加载方式 */
const path = require('path');

const store = {};
global.wx = {
  getStorageSync: k => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: k => { delete store[k]; }
};

const LIB = 'E:/deepseek/fridge-pair/miniprogram/lib';
const G = require(path.join(LIB, 'shim.js'));
require(path.join(LIB, 'data.js'));
require(path.join(LIB, 'engine.js'));
require(path.join(LIB, 'store.js'));

const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
if (!D || !E || !S) {
  console.log('FAIL 核心未挂载:', !!D, !!E, !!S);
  process.exit(1);
}

S.load();
if (!S.state.family.loggedIn) { S.demoFamily(); S.save(); }

const c = E.counts(S.state.foods);
const week = E.planWeek(S.state);
const cookable = E.cookable(S.state.foods);

console.log(JSON.stringify({
  foods: S.state.foods.length,
  dishes: D.DISHES.length,
  fourColors: c,
  weekDays: week.length,
  firstDay: week[0].label,
  meals: Object.keys(week[0].meals),
  cookable: cookable.length,
  sampleKcal: E.dishNutrition(D.DISHES[0]).kcal,
  storageKey: Object.keys(store)
}, null, 1));

const target = cookable[0];
if (target) {
  const before = S.state.foods.length;
  const res = E.cook(target, S.state);
  S.save();
  console.log('cook:', target.name, '| 扣减', res.used.length, '项 | 食材数', before, '→', S.state.foods.length);
}
