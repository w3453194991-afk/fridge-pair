/* ============================================================
   云函数：recognize
   ------------------------------------------------------------
   小程序 → wx.cloud.callFunction → 本函数 → 百度 AI
   优点：不占用 request 合法域名、不需要备案、不需要自己买服务器。

   部署：
     1. 开发者工具左上角「云开发」→ 开通（选免费额度）
     2. 右键 cloudfunctions/recognize → 「上传并部署：云端安装依赖」
     3. 云开发控制台 → 云函数 → recognize → 配置 → 环境变量：
          BAIDU_API_KEY    = 你的 API Key
          BAIDU_API_SECRET = 你的 Secret
   ============================================================ */
const cloud = require('wx-server-sdk');
const https = require('https');
const { URL } = require('url');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ALIAS = {
  '西红柿': '番茄', '洋柿子': '番茄',
  '马铃薯': '土豆', '洋芋': '土豆',
  '红萝卜': '胡萝卜',
  '柿子椒': '青椒', '彩椒': '青椒',
  '大白菜': '白菜', '娃娃菜': '白菜',
  '西蓝花': '西兰花',
  '青瓜': '黄瓜',
  '圆葱': '洋葱',
  '大葱': '葱', '小葱': '葱', '香葱': '葱',
  '大蒜': '蒜', '生姜': '姜',
  '蘑菇': '香菇',
  '纯牛奶': '牛奶', '土鸡蛋': '鸡蛋'
};

function normalizeName(raw) {
  if (!raw) return '';
  const n = String(raw).trim();
  if (ALIAS[n]) return ALIAS[n];
  const cut = n.split(/[（(_\s\-—·]/)[0];
  return ALIAS[cut] || cut;
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('返回非 JSON: ' + data.slice(0, 160))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('请求百度超时（8s）')));
    if (body) req.write(body);
    req.end();
  });
}

let tokenCache = { value: '', expireAt: 0 };

async function getToken(key, secret) {
  const now = Date.now();
  if (tokenCache.value && now < tokenCache.expireAt) return tokenCache.value;
  const u = new URL('https://aip.baidubce.com/oauth/2.0/token');
  u.searchParams.set('grant_type', 'client_credentials');
  u.searchParams.set('client_id', key);
  u.searchParams.set('client_secret', secret);
  const res = await request({
    hostname: u.hostname,
    path: u.pathname + u.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': 0 }
  });
  if (!res || !res.access_token) throw new Error('token 获取失败: ' + JSON.stringify(res).slice(0, 160));
  tokenCache = {
    value: res.access_token,
    expireAt: now + Math.max(60, (res.expires_in || 2592000) - 600) * 1000
  };
  return tokenCache.value;
}

const MOCK_SETS = [
  [{ name: '番茄', score: 0.96 }, { name: '鸡蛋', score: 0.93 }, { name: '菠菜', score: 0.71 }],
  [{ name: '土豆', score: 0.94 }, { name: '青椒', score: 0.88 }, { name: '洋葱', score: 0.66 }],
  [{ name: '牛奶', score: 0.97 }, { name: '苹果', score: 0.82 }, { name: '胡萝卜', score: 0.6 }]
];
function mock() {
  const s = MOCK_SETS[Math.floor(Math.random() * MOCK_SETS.length)];
  return s.map(x => ({ name: x.name, score: x.score, raw: x.name }));
}

exports.main = async (event) => {
  const key = process.env.BAIDU_API_KEY || '';
  const secret = process.env.BAIDU_API_SECRET || '';
  let image = String((event && event.image) || '').replace(/^data:image\/\w+;base64,/, '');

  if (!image) return { ok: false, error: '缺少 image', items: [] };

  // 没配密钥就直接说清楚，不要返回假数据
  if (!key || !secret) {
    return {
      ok: false,
      source: 'mock',
      error: '云函数没读到百度密钥：请在 云函数 → recognize → 配置 → 环境变量 添加 BAIDU_API_KEY / BAIDU_API_SECRET，保存后重新部署',
      hasKey: !!key,
      hasSecret: !!secret,
      items: []
    };
  }

  try {
    const token = await getToken(key, secret);
    const body = 'image=' + encodeURIComponent(image);

    // ① 果蔬 / 食材识别
    try {
      const r1 = await request({
        hostname: 'aip.baidubce.com',
        path: '/rest/2.0/image-classify/v1/classify/ingredient?access_token=' + token,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        }
      }, body);
      if (r1 && Array.isArray(r1.result) && r1.result.length) {
        return {
          ok: true,
          source: 'baidu',
          items: r1.result.slice(0, 8).map(x => ({
            name: normalizeName(x.name),
            score: Math.round((x.score || x.probability || 0) * 100) / 100,
            raw: x.name
          }))
        };
      }
    } catch (e) {
      console.warn('ingredient 失败，改用 dish:', e.message);
    }

    // ② 菜品识别兜底
    const r2 = await request({
      hostname: 'aip.baidubce.com',
      path: '/rest/2.0/image-classify/v2/dish?access_token=' + token,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    if (r2 && Array.isArray(r2.result)) {
      return {
        ok: true,
        source: 'baidu',
        items: r2.result.slice(0, 8).map(x => ({
          name: normalizeName(x.name),
          score: Math.round((x.probability || 0) * 100) / 100,
          raw: x.name
        }))
      };
    }
    return { ok: false, error: '百度返回异常', items: mock() };
  } catch (e) {
    console.error('识别失败', e.message);
    return { ok: false, source: 'error', error: e.message, items: mock() };
  }
};
