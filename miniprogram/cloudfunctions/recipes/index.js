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

/* 把平台错误翻译成人话 */
function juheHint(reason) {
  const r = String(reason || '');
  if (/KEY|密钥/i.test(r)) return '（AppKey 不对：去 聚合控制台 → 我的数据 → 菜谱查询 复制 AppKey，填到云函数 recipes 的 RECIPE_KEY，保存后重新部署）';
  if (/次数|限制|超过/i.test(r)) return '（今天的免费次数用完了，明天再试，或在聚合后台升级套餐）';
  if (/未开通|无权限|没有权限/i.test(r)) return '（这个接口还没申请：回聚合详情页点「申请数据」）';
  if (/实名|认证/i.test(r)) return '（聚合账号需要先完成实名认证）';
  return '';
}

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

/* 把「生猪里脊丝300克，红椒末少许」拆成 {name, qty} */
function parseMaterials(str) {
  const UNIT = '(?:克|g|千克|kg|毫升|ml|升|L|匙|小匙|中匙|大匙|汤匙|茶匙|个|根|颗|枚|片|块|把|勺|杯|碗|少许|适量)';
  const out = [];
  String(str || '')
    .split(/[，,\n;；]/)                       // 只在逗号/换行处切
    .map(s => s.trim().replace(/[。.]$/, ''))
    .filter(Boolean)
    .forEach(seg => {
      let name = seg;
      const m = seg.match(new RegExp('^(.+?)\\s*(\\d+(?:\\.\\d+)?\\s*' + UNIT + '?)\\s*$'));
      if (m && m[1]) name = m[1].trim();
      name = name.replace(/[（(][^）)]*[)）]$/, '').replace(/[、,，]$/, '').trim();
      // 一长串「葱、蒜末、豆瓣酱、酱油」这种，按顿号再拆
      if (name.length > 12 && name.indexOf('、') > 0) {
        name.split('、').forEach(x => {
          const v = x.trim();
          if (v && v.length <= 12) out.push({ name: v, qty: 1 });
        });
      } else if (name) {
        out.push({ name: name, qty: 1 });
      }
    });
  return out;
}

/* 做法是一大段文字，按换行或「1.」切步骤 */
function parseZuofa(str) {
  const s = String(str || '').replace(/\r/g, '').trim();
  if (!s) return [];
  let parts = s.split(/\n+/).map(x => x.trim()).filter(Boolean);
  if (parts.length <= 1) {
    parts = s.split(/(?=\d{1,2}[.、)）])/).map(x => x.trim()).filter(Boolean);
  }
  return parts
    .map(x => ({ heat: '', text: x.replace(/^\d{1,2}[.、)）:：]\s*/, '').trim() }))
    .filter(x => x.text.length > 1);
}

/* 聚合「菜谱查询」fapigx 接口的真实结构 */
function normJuhe(item) {
  const typeName = item.type_name || '';
  return {
    name: item.cp_name || item.name || '',
    emoji: '🍽',
    minutes: 20,
    level: '进阶',
    cuisine: typeName ? [typeName] : ['家常'],
    tags: ['网上菜谱'].concat(typeName ? [typeName] : []),
    ingredients: parseMaterials(item.yuanliao),
    seasonings: splitLines(item.tiaoliao),
    prep: [],
    steps: parseZuofa(item.zuofa),
    tips: [item.texing, item.tishi].filter(Boolean),
    nutrition: '来自网上菜谱，营养值按主要食材估算。',
    pair: '网上菜谱 · 仅供参考',
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
  // 真实接口（API Explorer 里确认的）：/fapigx/caipu/query，参数 key/word/num/page
  const API = 'https://apis.juhe.cn/fapigx/caipu/query';

  const tryWord = async (w) => {
    const url = API + '?key=' + encodeURIComponent(KEY) +
      '&word=' + encodeURIComponent(w) + '&num=10&page=1';
    return await request(url);
  };

  /* 逐级降级的关键词：原名 → 去做法前缀 → 后两字 → 前两字 */
  const METHOD_PREFIX = /^(拔丝|清炒|清蒸|红烧|凉拌|干煸|爆炒|蒜蓉|香煎|糖醋|水煮|麻辣|酱焖|小炒|炖|煎|蒸|炒|拌|烧)+/;
  const words = [keyword];
  const stripped = keyword.replace(METHOD_PREFIX, '');
  if (stripped && stripped !== keyword) words.push(stripped);
  if (keyword.length > 2) words.push(keyword.slice(-2));
  if (keyword.length > 2) words.push(keyword.slice(0, 2));

  let r = null;
  let tried = [];
  for (const w of words) {
    if (tried.indexOf(w) >= 0) continue;
    tried.push(w);
    let res = await tryWord(w);
    // 网络超时类错误，等一下重试一次
    if (res && [273300, 273301].indexOf(Number(res.error_code)) >= 0) {
      await new Promise(ok => setTimeout(ok, 400));
      res = await tryWord(w);
    }
    if (res && (!res.error_code || Number(res.error_code) === 0)) { r = res; break; }
    r = res;   // 记住最后一次，便于报错
  }

  if (!r) throw new Error('聚合接口无响应');

  if (r.error_code && Number(r.error_code) !== 0) {
    const code = Number(r.error_code);
    if (code === 273303) return [];                 // 库里确实没有这道菜
    if (code === 273300) throw new Error('聚合接口超时（273300），可能是今日免费次数用完或服务波动，稍后再试');
    throw new Error('聚合返回：' + (r.reason || '') + juheHint(r.reason));
  }

  const list = (r.result && (r.result.list || r.result.data)) || [];
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
    const keyLen = (KEY || '').length;
    let keyWarn = '';
    if (KEY && SOURCE === 'juhe' && keyLen !== 32) {
      keyWarn = '聚合 AppKey 应为 32 位，当前 ' + keyLen + ' 位，很可能没复制全';
    }
    return {
      ok: true,
      configured: !!(SOURCE && KEY && FETCHERS[SOURCE]),
      source: SOURCE || '(未设置)',
      hasKey: !!KEY,
      keyLen: keyLen,
      keyWarn: keyWarn,
      hint: !SOURCE ? '未设置 RECIPE_SOURCE（juhe / tianapi / jisu）'
        : (!KEY ? '未设置 RECIPE_KEY'
          : (FETCHERS[SOURCE] ? (keyWarn || '') : '不支持的 RECIPE_SOURCE'))
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
    return {
      ok: false,
      error: String((e && e.message) || e),
      // 诊断信息：让调用方看出这次跑的是哪版代码、读到的 key 有多长
      build: 'v3-keylen-diagnostic',
      source: SOURCE,
      keyLen: (KEY || '').length,
      keyHead: (KEY || '').slice(0, 4),
      keyTail: (KEY || '').slice(-4)
    };
  }
};
