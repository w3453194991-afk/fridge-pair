/* ============================================================
   冰箱对对碰 · 食材识别中转服务
   ------------------------------------------------------------
   作用：小程序不直接调百度（密钥会泄露），改为调这个服务，
        由服务端带密钥请求百度，再把结果规范化返回。

   启动：
     set BAIDU_API_KEY=xxx
     set BAIDU_API_SECRET=yyy
     node index.js
   无密钥时自动进入 mock 模式，返回模拟结果（demo 可用）。

   接口：
     GET  /health          → { ok, mode, uptime }
     POST /recognize       → body { image: "<base64，可带 data: 前缀>" }
                            ← { ok, source, items:[{name, score, raw}] }
   ============================================================ */
const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 8787;
const KEY = process.env.BAIDU_API_KEY || '';
const SECRET = process.env.BAIDU_API_SECRET || '';
const FORCE_MOCK = process.argv.includes('--mock');
const MOCK = FORCE_MOCK || !KEY || !SECRET;

/* 百度返回的名字 → 我们食材库里的名字 */
const ALIAS = {
  '西红柿': '番茄', '洋柿子': '番茄',
  '马铃薯': '土豆', '洋芋': '土豆',
  '红萝卜': '胡萝卜',
  '青椒': '青椒', '柿子椒': '青椒', '彩椒': '青椒',
  '大白菜': '白菜', '娃娃菜': '白菜',
  '鸡蛋': '鸡蛋', '土鸡蛋': '鸡蛋',
  '牛奶': '牛奶', '纯牛奶': '牛奶',
  '猪肉': '猪肉', '五花肉': '五花肉',
  '牛肉': '牛肉', '牛里脊': '牛里脊',
  '鸡肉': '鸡肉', '鸡胸肉': '鸡胸肉',
  '豆腐': '豆腐', '嫩豆腐': '豆腐',
  '洋葱': '洋葱', '圆葱': '洋葱',
  '大葱': '葱', '小葱': '葱', '香葱': '葱',
  '大蒜': '蒜', '蒜': '蒜',
  '生姜': '姜', '姜': '姜',
  '蘑菇': '香菇', '香菇': '香菇',
  '西兰花': '西兰花', '西蓝花': '西兰花',
  '黄瓜': '黄瓜', '青瓜': '黄瓜',
  '苹果': '苹果', '香蕉': '香蕉', '葡萄': '葡萄',
  '梨': '梨', '橙子': '橙子', '橘子': '橘子',
  '鱼': '鲈鱼', '鲈鱼': '鲈鱼', '虾': '虾', '大虾': '虾'
};

function normalizeName(raw) {
  if (!raw) return '';
  const n = String(raw).trim();
  if (ALIAS[n]) return ALIAS[n];
  // 去掉后缀词，如「西红柿(番茄)」「鸡蛋_土鸡蛋」
  const cut = n.split(/[（(_\s\-—·]/)[0];
  return ALIAS[cut] || cut;
}

/* ---------------- 百度 AI ---------------- */
let tokenCache = { value: '', expireAt: 0 };

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('返回不是 JSON: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('请求超时')); });
    if (body) req.write(body);
    req.end();
  });
}

async function getToken() {
  const now = Date.now();
  if (tokenCache.value && now < tokenCache.expireAt) return tokenCache.value;

  const u = new URL('https://aip.baidubce.com/oauth/2.0/token');
  u.searchParams.set('grant_type', 'client_credentials');
  u.searchParams.set('client_id', KEY);
  u.searchParams.set('client_secret', SECRET);

  const res = await httpsRequest({
    hostname: u.hostname,
    path: u.pathname + u.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': 0 }
  });

  if (!res || !res.access_token) {
    throw new Error('获取 access_token 失败: ' + JSON.stringify(res).slice(0, 200));
  }
  tokenCache = {
    value: res.access_token,
    expireAt: now + Math.max(60, (res.expires_in || 2592000) - 600) * 1000
  };
  return tokenCache.value;
}

async function baiduRecognize(base64) {
  const token = await getToken();
  const body = 'image=' + encodeURIComponent(base64);

  // ① 果蔬/食材识别（最贴我们的场景）
  try {
    const r1 = await httpsRequest({
      hostname: 'aip.baidubce.com',
      path: '/rest/2.0/image-classify/v1/classify/ingredient?access_token=' + token,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    if (r1 && Array.isArray(r1.result) && r1.result.length) {
      return r1.result.slice(0, 8).map(x => ({
        name: normalizeName(x.name),
        score: Math.round((x.score || x.probability || 0) * 100) / 100,
        raw: x.name
      }));
    }
  } catch (e) {
    console.warn('[ingredient] 失败，改用菜品识别:', e.message);
  }

  // ② 菜品识别兜底
  const r2 = await httpsRequest({
    hostname: 'aip.baidubce.com',
    path: '/rest/2.0/image-classify/v2/dish?access_token=' + token,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);

  if (!r2 || !Array.isArray(r2.result)) {
    throw new Error('百度返回异常: ' + JSON.stringify(r2).slice(0, 200));
  }
  return r2.result.slice(0, 8).map(x => ({
    name: normalizeName(x.name),
    score: Math.round((x.probability || 0) * 100) / 100,
    raw: x.name
  }));
}

/* ---------------- mock ---------------- */
const MOCK_SETS = [
  [{ name: '番茄', score: 0.96 }, { name: '鸡蛋', score: 0.93 }, { name: '菠菜', score: 0.71 }],
  [{ name: '土豆', score: 0.94 }, { name: '青椒', score: 0.88 }, { name: '洋葱', score: 0.66 }],
  [{ name: '牛奶', score: 0.97 }, { name: '苹果', score: 0.82 }, { name: '胡萝卜', score: 0.6 }],
  [{ name: '豆腐', score: 0.91 }, { name: '香菇', score: 0.85 }, { name: '葱', score: 0.58 }]
];

function mockRecognize() {
  const set = MOCK_SETS[Math.floor(Math.random() * MOCK_SETS.length)];
  return set.map(x => ({ ...x, raw: x.name }));
}

/* ---------------- HTTP ---------------- */
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { json(res, 204, {}); return; }

  const u = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && u.pathname === '/health') {
    json(res, 200, {
      ok: true,
      mode: MOCK ? 'mock' : 'baidu',
      uptime: Math.round(process.uptime()),
      hint: MOCK ? '未配置 BAIDU_API_KEY / BAIDU_API_SECRET，返回模拟结果' : '已连接百度 AI'
    });
    return;
  }

  if (req.method === 'POST' && u.pathname === '/recognize') {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 12 * 1024 * 1024) req.destroy();   // 12MB 上限
    });
    req.on('end', async () => {
      let image = '';
      try {
        const body = JSON.parse(raw || '{}');
        image = String(body.image || '');
      } catch (e) {
        json(res, 400, { ok: false, error: 'body 不是合法 JSON' });
        return;
      }
      // 去掉 data:image/...;base64, 前缀
      image = image.replace(/^data:image\/\w+;base64,/, '');
      if (!image) {
        json(res, 400, { ok: false, error: '缺少 image 字段（base64）' });
        return;
      }

      try {
        const items = MOCK ? mockRecognize() : await baiduRecognize(image);
        json(res, 200, { ok: true, source: MOCK ? 'mock' : 'baidu', items });
      } catch (e) {
        console.error('[recognize] 失败', e.message);
        json(res, 200, {
          ok: false,
          source: 'error',
          error: e.message,
          items: mockRecognize()      // 出错也返回兜底结果，避免演示中断
        });
      }
    });
    return;
  }

  json(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log(' 冰箱对对碰 · 识别中转服务已启动');
  console.log(' 地址:  http://127.0.0.1:' + PORT);
  console.log(' 模式:  ' + (MOCK ? 'MOCK（未配置百度密钥）' : '百度 AI 真实识别'));
  console.log(' 接口:  GET /health   POST /recognize');
  console.log('========================================');
});
