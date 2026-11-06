/* ============================================================
   展示用文案映射
   ------------------------------------------------------------
   背景：小程序类目走「工具」，不能出现疾病名。
   所以内部照旧用原 key（引擎的营养规则依赖它），
   但界面上统一显示成「饮食需求」的说法。
   ============================================================ */

const COND_LABEL = {
  '高血压': '少盐',
  '高血脂': '少油',
  '糖尿病': '少糖',
  '痛风': '低嘌呤',
  '肾病': '低蛋白',
  '胃病': '温和少刺激'
};

const COND_HINT = {
  '高血压': '少吃腌制品、少酱油',
  '高血脂': '少油炸、少肥肉',
  '糖尿病': '主食减半、少甜食',
  '痛风': '少海鲜内脏、少浓汤',
  '肾病': '少高蛋白、少盐',
  '胃病': '少辣少酸、别太凉'
};

const COND_ICON = {
  '高血压': '⚖️',
  '高血脂': '🫒',
  '糖尿病': '🍬',
  '痛风': '🦐',
  '肾病': '🥛',
  '胃病': '🍵'
};

function condLabel(k) {
  return COND_LABEL[k] || k;
}
function condHint(k) {
  return COND_HINT[k] || '';
}
function condIcon(k) {
  return COND_ICON[k] || '🍽';
}
function condText(list) {
  const arr = (list || []).map(condLabel);
  return arr.length ? arr.join('、') : '';
}

module.exports = {
  COND_LABEL: COND_LABEL,
  condLabel: condLabel,
  condHint: condHint,
  condIcon: condIcon,
  condText: condText
};
