/* ============================================================
   云函数：db
   ------------------------------------------------------------
   按 openid 读写当前用户的数据（冰箱、家庭档案、菜单等）。
   调用前请先在 云开发控制台 → 数据库 新建集合：users

   action = 'get'  → { ok, data: { state } | null }
   action = 'save' → { ok }
   ============================================================ */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COL = 'users';

exports.main = async (event) => {
  const ctx = cloud.getWXContext();
  const openid = ctx.OPENID || '';
  if (!openid) return { ok: false, error: '拿不到 openid' };

  const action = (event && event.action) || 'get';

  try {
    if (action === 'get') {
      const r = await db.collection(COL).where({ openid: openid }).limit(1).get();
      const doc = (r.data && r.data[0]) || null;
      return { ok: true, data: doc ? { state: doc.state, updatedAt: doc.updatedAt } : null };
    }

    if (action === 'save') {
      const state = (event && event.data) || null;
      if (!state) return { ok: false, error: '缺少 data' };

      const exist = await db.collection(COL).where({ openid: openid }).limit(1).get();
      if (exist.data && exist.data.length) {
        await db.collection(COL).doc(exist.data[0]._id).update({
          data: { state: state, updatedAt: Date.now() }
        });
      } else {
        await db.collection(COL).add({
          data: { openid: openid, state: state, updatedAt: Date.now() }
        });
      }
      return { ok: true };
    }

    return { ok: false, error: '未知 action: ' + action };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
};
