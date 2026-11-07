/* ============================================================
   云函数：videos —— 共享做法视频库
   ------------------------------------------------------------
   集合：videos
     { dishId, dishName, title, fileID, cover, at, _openid, status }

   接口：
     { action:'list', dishId }    → 某道菜的所有视频（所有人可见）
     { action:'mine' }            → 我发布过的
     { action:'publish', dishId, dishName, title, fileID, cover }
     { action:'remove', id }      → 只能删自己的
   ============================================================ */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const COL = 'videos';

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'list';

  try {
    if (action === 'list') {
      const where = { status: 'ok' };
      if (event.dishId) where.dishId = String(event.dishId);
      const r = await db.collection(COL).where(where)
        .orderBy('at', 'desc').limit(Number(event.limit) || 20).get();
      return {
        ok: true,
        items: (r.data || []).map(x => ({
          id: x._id,
          dishId: x.dishId,
          dishName: x.dishName,
          title: x.title || '',
          fileID: x.fileID,
          cover: x.cover || '',
          at: x.at || 0,
          mine: x._openid === OPENID
        }))
      };
    }

    if (action === 'mine') {
      const r = await db.collection(COL).where({ _openid: OPENID, status: 'ok' })
        .orderBy('at', 'desc').limit(50).get();
      return {
        ok: true,
        items: (r.data || []).map(x => ({
          id: x._id, dishId: x.dishId, dishName: x.dishName,
          title: x.title || '', fileID: x.fileID, at: x.at || 0, mine: true
        }))
      };
    }

    if (action === 'publish') {
      const dishId = String(event.dishId || '');
      const fileID = String(event.fileID || '');
      if (!dishId || !fileID) return { ok: false, error: '缺少 dishId 或 fileID' };
      const doc = {
        dishId: dishId,
        dishName: String(event.dishName || ''),
        title: String(event.title || ''),
        fileID: fileID,
        cover: String(event.cover || ''),
        at: Date.now(),
        status: 'ok'
      };
      const r = await db.collection(COL).add({ data: doc });
      return { ok: true, id: r._id };
    }

    if (action === 'remove') {
      const id = String(event.id || '');
      if (!id) return { ok: false, error: '缺少 id' };
      const got = await db.collection(COL).doc(id).get().catch(() => null);
      const doc = got && got.data;
      if (!doc) return { ok: false, error: '视频不存在' };
      if (doc._openid !== OPENID) return { ok: false, error: '只能删除自己发布的视频' };
      await db.collection(COL).doc(id).update({ data: { status: 'deleted' } });
      return { ok: true };
    }

    return { ok: false, error: '未知 action' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
};
