/* ============================================================
   价格展示工具
   ------------------------------------------------------------
   菜价本身波动大（不同城市、不同渠道能差 50%），
   所以不显示"精确价"，显示区间：±28%。
   ============================================================ */

function fmt(x) {
  const n = Number(x) || 0;
  if (n >= 50) return Math.round(n);
  if (n >= 10) return Math.round(n * 10) / 10;
  return Math.round(n * 10) / 10;
}

/* 输入参考价，返回 { lo, hi, text }，text 形如 "3.6~6.4" */
function range(v) {
  const n = Number(v) || 0;
  if (n <= 0) return { lo: 0, hi: 0, text: '—' };
  const lo = fmt(n * 0.72);
  const hi = fmt(n * 1.28);
  return { lo: lo, hi: hi, text: (lo === hi ? String(lo) : lo + '~' + hi) };
}

/* 带 ¥ 的区间，如 "¥3.6~6.4" */
function yuan(v) {
  const r = range(v);
  return r.text === '—' ? '—' : ('¥' + r.text);
}

module.exports = { range: range, yuan: yuan, fmt: fmt };
