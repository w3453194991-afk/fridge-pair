/* ============================================================
   云函数：gallery —— 菜品实拍图库（公开、可审核）
   ------------------------------------------------------------
   集合：dish_photos
     { dishId, dishName, fileID, nick, openid, at, status }

   环境变量：
     ADMIN_OPENIDS   管理员 openid，逗号分隔
     REVIEW_MODE     manual（默认）/ auto

   接口：
     { action:'list', dishId }        某道菜的公开实拍（含自己待审）
     { action:'publish', dishId, dishName, fileID, nick }
     { action:'mine' }                我上传的
     { action:'remove', id }
     { action:'pending' }             管理员：待审
     { action:'approve'|'block', id } 管理员
   ============================================================ */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const COL = 'dish_photos';


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

function mapItem(x, openid) {
  return {
    id: x._id,
    dishId: x.dishId,
    dishName: x.dishName || '',
    fileID: x.fileID,
    nick: x.nick || '冰箱用户',
    at: x.at || 0,
    status: x.status || 'ok',
    mine: x.openid === openid
  };
}

async function imgCheck(fileID) {
  try {
    const r = await cloud.callFunction({ name: 'security', data: { action: 'img', fileID: fileID } });
    const out = (r && r.result) || {};
    if (out.ok && out.pass === false) return 'block';
    if (out.ok && out.pass === true && !out.degraded) return 'pass';
    return 'degraded';
  } catch (e) {
    return 'degraded';
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'list';
  const isAdmin = await isAdminUser(OPENID);

  try {
    if (action === 'whoami') return { ok: true, isAdmin: isAdmin };

    if (action === 'list') {
      const dishId = String(event.dishId || '');
      if (!dishId) return { ok: false, error: '缺少 dishId' };
      const r = await db.collection(COL).where({ dishId: dishId, status: 'ok' })
        .orderBy('at', 'desc').limit(30).get();
      let items = (r.data || []).map(x => mapItem(x, OPENID));

      const own = await db.collection(COL)
        .where({ dishId: dishId, openid: OPENID, status: 'pending' })
        .orderBy('at', 'desc').limit(10).get().catch(() => ({ data: [] }));
      (own.data || []).forEach(x => {
        const it = mapItem(x, OPENID);
        if (!items.some(i => i.id === it.id)) items.unshift(it);
      });

      return { ok: true, items: items, count: items.filter(i => i.status === 'ok').length };
    }

    if (action === 'mine') {
      const r = await db.collection(COL).where({ openid: OPENID })
        .orderBy('at', 'desc').limit(50).get();
      return { ok: true, items: (r.data || []).map(x => mapItem(x, OPENID)) };
    }

    if (action === 'publish') {
      const dishId = String(event.dishId || '');
      const fileID = String(event.fileID || '');
      if (!dishId || !fileID) return { ok: false, error: '缺少 dishId 或 fileID' };

      const verdict = await imgCheck(fileID);
      if (verdict === 'block') return { ok: false, error: '图片未通过安全检测' };

      const needReview = verdict !== 'pass' && !isAdmin && !autoReview();

      const doc = {
        dishId: dishId,
        dishName: String(event.dishName || ''),
        fileID: fileID,
        nick: String(event.nick || '').slice(0, 20),
        openid: OPENID,
        at: Date.now(),
        status: needReview ? 'pending' : 'ok'
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
