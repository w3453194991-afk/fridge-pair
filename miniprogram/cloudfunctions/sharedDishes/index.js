/* ============================================================
   云函数：sharedDishes —— 共享菜谱库
   ------------------------------------------------------------
   集合：shared_dishes
     { dishId, name, emoji, cuisine:[], tags:[], minutes, level,
       ingredients:[], seasonings:[], prep:[], steps:[], tips:[],
       nick, openid, at, status, srcId }

   环境变量：
     ADMIN_OPENIDS   管理员 openid（逗号分隔）
     REVIEW_MODE     manual（默认）/ auto

   接口：
     { action:'list', keyword }     公开菜谱（可按关键词过滤）
     { action:'publish', dish }     分享一道菜
     { action:'mine' }              我分享的
     { action:'remove', id }
     { action:'pending' }           管理员
     { action:'approve'|'block', id }
   ============================================================ */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const COL = 'shared_dishes';


/* 管理员名单：环境变量 ADMIN_OPENIDS 优先，其次 settings/admin 集合的 openids 数组 */
const SETTINGS_COL = 'settings';

function adminsFromEnv() {
  return String(process.env.ADMIN_OPENIDS || '')
    .split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
}

/* 名单兼容：数组 or 逗号分隔字符串 */
function normList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  return String(raw).split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
}

async function getAdminList() {
  const env = adminsFromEnv();
  if (env.length) return env;
  try {
    const r = await db.collection(SETTINGS_COL).doc('admin').get();
    return normList(r && r.data && r.data.openids);
  } catch (e) {
    return [];
  }
}
function autoReview() {
  return String(process.env.REVIEW_MODE || 'manual').toLowerCase() === 'auto';
}

/* 管理员判定：直接比对名单，不跨函数调用 */
async function isAdminUser(openid) {
  if (!openid) return false;
  const list = await getAdminList();
  return list.indexOf(openid) >= 0;
}

async function textCheck(content) {
  const t = String(content || '').trim();
  if (!t) return { pass: true };
  try {
    const r = await cloud.callFunction({ name: 'security', data: { action: 'text', content: t, scene: 2 } });
    const out = (r && r.result) || {};
    if (out.ok === false) return { pass: true, degraded: true };
    return { pass: out.pass !== false };
  } catch (e) {
    return { pass: true, degraded: true };
  }
}

function mapItem(x, openid) {
  return {
    id: x._id,
    dishId: x.dishId || x._id,
    name: x.name || '',
    emoji: x.emoji || '🍽',
    cuisine: x.cuisine || [],
    tags: x.tags || [],
    minutes: x.minutes || 20,
    level: x.level || '进阶',
    ingredients: x.ingredients || [],
    seasonings: x.seasonings || [],
    prep: x.prep || [],
    steps: x.steps || [],
    tips: x.tips || [],
    nutrition: x.nutrition || '',
    pair: x.pair || '',
    nick: x.nick || '冰箱用户',
    at: x.at || 0,
    status: x.status || 'ok',
    mine: x.openid === openid
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'list';
  const isAdmin = await isAdminUser(OPENID);

  try {
    if (action === 'whoami') return { ok: true, isAdmin: isAdmin };

    if (action === 'list') {
      const kw = String(event.keyword || '').trim();
      const r = await db.collection(COL).where({ status: 'ok' })
        .orderBy('at', 'desc').limit(Number(event.limit) || 60).get();
      let items = (r.data || []).map(x => mapItem(x, OPENID));
      if (kw) {
        items = items.filter(x =>
          x.name.indexOf(kw) >= 0 ||
          (x.tags || []).some(t => t.indexOf(kw) >= 0) ||
          (x.ingredients || []).some(i => (i.name || '').indexOf(kw) >= 0)
        );
      }
      return { ok: true, items: items };
    }

    if (action === 'mine') {
      const r = await db.collection(COL).where({ openid: OPENID })
        .orderBy('at', 'desc').limit(50).get();
      return { ok: true, items: (r.data || []).map(x => mapItem(x, OPENID)) };
    }

    if (action === 'publish') {
      const d = event.dish || {};
      const name = String(d.name || '').trim();
      if (!name) return { ok: false, error: '缺少菜名' };
      if (!Array.isArray(d.steps) || !d.steps.length) return { ok: false, error: '这道菜还没有做法' };

      const c = await textCheck(name + ' ' + (d.tags || []).join(' '));
      if (!c.pass) return { ok: false, error: '菜名或标签未通过安全检测' };

      // 同一个来源只分享一次
      const srcId = String(d.id || '');
      const dup = await db.collection(COL)
        .where({ openid: OPENID, srcId: srcId, status: db.command.neq('deleted') })
        .limit(1).get().catch(() => ({ data: [] }));
      if ((dup.data || []).length) return { ok: false, error: '这道菜你已经分享过了' };

      const doc = {
        srcId: srcId,
        dishId: 's-' + (srcId || Date.now().toString(36)),
        name: name,
        emoji: String(d.emoji || '🍽'),
        cuisine: Array.isArray(d.cuisine) ? d.cuisine.slice(0, 3) : [],
        tags: Array.isArray(d.tags) ? d.tags.slice(0, 6) : [],
        minutes: Number(d.minutes) || 20,
        level: String(d.level || '进阶'),
        ingredients: Array.isArray(d.ingredients) ? d.ingredients.slice(0, 12) : [],
        seasonings: Array.isArray(d.seasonings) ? d.seasonings.slice(0, 12) : [],
        prep: Array.isArray(d.prep) ? d.prep.slice(0, 8) : [],
        steps: Array.isArray(d.steps) ? d.steps.slice(0, 20) : [],
        tips: Array.isArray(d.tips) ? d.tips.slice(0, 6) : [],
        nutrition: String(d.nutrition || ''),
        pair: String(d.pair || ''),
        nick: String(d.nick || '').slice(0, 20),
        openid: OPENID,
        at: Date.now(),
        status: (isAdmin || autoReview()) ? 'ok' : 'pending'
      };
      const r = await db.collection(COL).add({ data: doc });
      return { ok: true, id: r._id, status: doc.status };
    }

    if (action === 'remove') {
      const id = String(event.id || '');
      if (!id) return { ok: false, error: '缺少 id' };
      const got = await db.collection(COL).doc(id).get().catch(() => null);
      const doc = got && got.data;
      if (!doc) return { ok: false, error: '不存在' };
      if (doc.openid !== OPENID && !isAdmin) return { ok: false, error: '只能删自己的' };
      await db.collection(COL).doc(id).update({ data: { status: 'deleted' } });
      return { ok: true };
    }

    if (action === 'pending') {
      if (!isAdmin) return { ok: false, error: '需要管理员权限' };
      const r = await db.collection(COL).where({ status: 'pending' })
        .orderBy('at', 'desc').limit(50).get();
      return { ok: true, items: (r.data || []).map(x => mapItem(x, OPENID)) };
    }

    if (action === 'approve' || action === 'block') {
      if (!isAdmin) return { ok: false, error: '需要管理员权限' };
      const id = String(event.id || '');
      if (!id) return { ok: false, error: '缺少 id' };
      await db.collection(COL).doc(id).update({
        data: { status: action === 'approve' ? 'ok' : 'blocked', reviewedAt: Date.now() }
      });
      return { ok: true };
    }

    return { ok: false, error: '未知 action' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
};
