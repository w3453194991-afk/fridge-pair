/* ============================================================
   云函数：recipes —— 网上菜谱网关
   ------------------------------------------------------------
   作用：小程序搜不到本地菜谱时，来这里取。
        云函数持有 API Key（前端拿不到），结果缓存进 recipes 集合。

   环境变量（三选一，按你注册的平台填）：
     RECIPE_SOURCE   = juhe | tianapi | jisu
     RECIPE_KEY      = 对应平台的 key / appkey
     RECIPE_API_ID   = 仅 juhe 需要（菜谱大全接口的 id，一般是 1118）

   接口：
     { action:'search', keyword:'松仁玉米' }
       → { ok, source:'cache|online', items:[{ name, ingredients:[], steps:[], ... }] }
     { action:'config' } → { ok, configured:false, hint:'...' }
   ============================================================ */
const cloud = require('wx-server-sdk');
const https = require('https');
const { URL } = require('url');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const COL = 'recipes';

const SOURCE = (process.env.RECIPE_SOURCE || '').toLowerCase();
const KEY = process.env.RECIPE_KEY || '';
const API_ID = process.env.RECIPE_API_ID || '';

function request(urlStr, method) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: method || 'GET',
      headers: { 'User-Agent': 'fridge-pair/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('返回非 JSON：' + data.slice(0, 160))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('请求超时（8s）')));
    req.end();
  });
}

/* ---------- 各平台适配：统一成内部结构 ---------- */

function toSteps(list) {
  return (list || []).map((s, i) => ({
    heat: '',
    text: String(s.step || s.text || s.content || s || '').replace(/\s+/g, ' ').trim()
  })).filter(s => s.text && s.text.length > 1);
}

function splitLines(str) {
  return String(str || '')
    .split(/[,，、;；\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function normJuhe(item) {
  const ing = splitLines(item.ingredients).map(s => ({ name: s.replace(/[\d.]+.*$/, '').trim() || s, qty: 1 }));
  const sea = splitLines(item.burden);
  return {
    name: item.title || '',
    emoji: '🍽',
    minutes: 20,
    level: '进阶',
    cuisine: (item.tags || '').split(',').filter(Boolean).slice(0, 2),
    tags: ['网上菜谱'],
    ingredients: ing,
    seasonings: sea,
    prep: [],
    steps: toSteps(item.steps),
    tips: [item.imtro || ''].filter(Boolean),
    source: 'juhe',
    sourceId: String(item.id || '')
  };
}

function normTianapi(item) {
  return {
    name: item.cp_name || item.name || '',
    emoji: '🍽',
    minutes: 20,
    level: '进阶',
    cuisine: ['家常'],
    tags: ['网上菜谱'],
    ingredients: splitLines(item.yuanliao || item.ingredients).map(s => ({ name: s, qty: 1 })),
    seasonings: splitLines(item.futiao || item.burden),
    prep: [],
    steps: toSteps(splitLines(item.zuofa || item.steps).map(t => ({ step: t }))),
    tips: [item.tips || ''].filter(Boolean),
    source: 'tianapi',
    sourceId: String(item.cp_id || item.id || '')
  };
}

function normJisu(item) {
  return {
    name: item.name || item.title || '',
    emoji: '🍽',
    minutes: Number(item.cooktime) || 20,
    level: '进阶',
    cuisine: [item.category || '家常'],
    tags: ['网上菜谱'],
    ingredients: splitLines(item.ingredient || item.material).map(s => ({ name: s, qty: 1 })),
    seasonings: splitLines(item.seasoning),
    prep: [],
    steps: toSteps(item.steps || item.process),
    tips: [item.tips || ''].filter(Boolean),
    source: 'jisu',
    sourceId: String(item.id || '')
  };
}

/* ---------- 各平台请求 ---------- */

async function fetchJuhe(keyword) {
  const url = 'https://apis.juhe.cn/cook/query?key=' + encodeURIComponent(KEY) +
    '&menu=' + encodeURIComponent(keyword) + '&rn=10&pn=1';
  const r = await request(url);
  if (!r || r.error_code) throw new Error('聚合接口错误：' + JSON.stringify(r && r.reason || r).slice(0, 120));
  const list = (r.result && r.result.data) || [];
  return list.map(normJuhe);
}

async function fetchTianapi(keyword) {
  const url = 'https://apis.tianapi.com/caipu/index?key=' + encodeURIComponent(KEY) +
    '&word=' + encodeURIComponent(keyword) + '&num=10';
  const r = await request(url);
  if (!r || r.code !== 200) throw new Error('天行接口错误：' + JSON.stringify(r).slice(0, 120));
  const list = (r.result && r.result.list) || [];
  return list.map(normTianapi);
}

async function fetchJisu(keyword) {
  const url = 'https://api.jisuapi.com/recipe/search?appkey=' + encodeURIComponent(KEY) +
    '&keyword=' + encodeURIComponent(keyword) + '&num=10';
  const r = await request(url);
  if (!r || r.status !== '0') throw new Error('极速接口错误：' + JSON.stringify(r).slice(0, 120));
  const list = (r.result && r.result.list) || [];
  return list.map(normJisu);
}

const FETCHERS = { juhe: fetchJuhe, tianapi: fetchTianapi, jisu: fetchJisu };

exports.main = async (event) => {
  const action = (event && event.action) || 'search';

  if (action === 'config') {
    return {
      ok: true,
      configured: !!(SOURCE && KEY && FETCHERS[SOURCE]),
      source: SOURCE || '(未设置)',
      hasKey: !!KEY,
      hint: !SOURCE ? '未设置 RECIPE_SOURCE（juhe / tianapi / jisu）'
        : (!KEY ? '未设置 RECIPE_KEY' : (FETCHERS[SOURCE] ? '' : '不支持的 RECIPE_SOURCE'))
    };
  }

  if (action !== 'search') return { ok: false, error: '未知 action' };

  const keyword = String(event.keyword || '').trim();
  if (!keyword) return { ok: false, error: '缺少 keyword' };

  /* 1) 先查缓存 */
  try {
    const cache = await db.collection(COL).where({ name: keyword }).limit(1).get();
    if (cache.data && cache.data.length && Array.isArray(cache.data[0].items) && cache.data[0].items.length) {
      return { ok: true, source: 'cache', items: cache.data[0].items };
    }
  } catch (e) {
    // 集合可能还不存在，忽略
  }

  /* 2) 没配密钥就直接说 */
  if (!SOURCE || !KEY || !FETCHERS[SOURCE]) {
    return {
      ok: false,
      error: '菜谱接口未配置：在云函数 recipes 的环境变量里设置 RECIPE_SOURCE / RECIPE_KEY',
      needConfig: true
    };
  }

  /* 3) 拉取 + 写缓存 */
  try {
    const items = await FETCHERS[SOURCE](keyword);
    const clean = (items || []).filter(x => x && x.name && (x.steps || []).length);
    if (clean.length) {
      try {
        await db.collection(COL).add({
          data: { name: keyword, items: clean, updatedAt: Date.now(), source: SOURCE }
        });
      } catch (e) {}
    }
    return { ok: true, source: 'online', count: clean.length, items: clean };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
};
