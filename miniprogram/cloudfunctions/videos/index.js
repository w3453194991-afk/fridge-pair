/* ============================================================
   云函数：videos —— 共享做法视频库（带人工审核）
   ------------------------------------------------------------
   集合：videos
     { dishId, dishName, title, fileID, cover, at, _openid,
       status: 'pending' | 'ok' | 'blocked' | 'deleted',
       checkTrace }

   环境变量：
     ADMIN_OPENIDS  管理员 openid，多个用英文逗号分隔
                    （不填则审核接口一律拒绝）

   接口：
     { action:'list', dishId, includeMine }  → 已通过 + 自己待审的
     { action:'mine' }                       → 我上传的全部
     { action:'publish', dishId, dishName, title, fileID, cover, traceId }
     { action:'remove', id }                 → 本人或管理员
     { action:'pending' }                    → 管理员：待审核列表
     { action:'approve', id }                → 管理员：通过
     { action:'block', id }                  → 管理员：驳回
   ============================================================ */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const COL = 'videos';

function admins() {
  return String(process.env.ADMIN_OPENIDS || '')
    .split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
}

function mapItem(x, openid) {
  return {
    id: x._id,
    dishId: x.dishId,
    dishName: x.dishName,
    title: x.title || '',
    fileID: x.fileID,
    cover: x.cover || '',
    at: x.at || 0,
    status: x.status || 'ok',
    mine: x._openid === openid
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'list';
  const isAdmin = admins().indexOf(OPENID) >= 0;

  try {
    /* ---------- 某道菜的视频：已通过 + 自己的待审 ---------- */
    if (action === 'list') {
      const base = { status: 'ok' };
      if (event.dishId) base.dishId = String(event.dishId);
      const r = await db.collection(COL).where(base)
        .orderBy('at', 'desc').limit(Number(event.limit) || 20).get();
      let items = (r.data || []).map(x => mapItem(x, OPENID));

      // 自己待审的也返回，标 pending，让他自己能看到
      const own = await db.collection(COL)
        .where(Object.assign({ _openid: OPENID, status: 'pending' },
          event.dishId ? { dishId: String(event.dishId) } : {}))
        .orderBy('at', 'desc').limit(10).get().catch(() => ({ data: [] }));
      const ownItems = (own.data || []).map(x => mapItem(x, OPENID));
      ownItems.forEach(o => { if (!items.some(i => i.id === o.id)) items.unshift(o); });

      return { ok: true, items: items, isAdmin: isAdmin };
    }

    if (action === 'mine') {
      const r = await db.collection(COL)
        .where({ _openid: OPENID })
        .orderBy('at', 'desc').limit(50).get();
      return { ok: true, items: (r.data || []).map(x => mapItem(x, OPENID)) };
    }

    /* ---------- 发布：先进待审 ---------- */
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
        status: isAdmin ? 'ok' : 'pending',     // 管理员发的一律直接上架
        checkTrace: String(event.traceId || '')
      };
      const r = await db.collection(COL).add({ data: doc });
      return { ok: true, id: r._id, status: doc.status };
    }

    /* ---------- 播放：云函数代取临时链接 ----------
       免费版存储是「仅创建者可读写」，客户端直接 getTempFileURL 别人会失败；
       云函数有管理员权限，可以替任何人换到可播放链接。 */
    if (action === 'play') {
      const id = String(event.id || '');
      if (!id) return { ok: false, error: '缺少 id' };
      const got = await db.collection(COL).doc(id).get().catch(() => null);
      const doc = got && got.data;
      if (!doc) return { ok: false, error: '视频不存在' };
      if (doc.status !== 'ok' && doc._openid !== OPENID && !isAdmin) {
        return { ok: false, error: '这个视频还在审核中' };
      }
      const fileID = String(doc.fileID || '');
      let url = fileID;
      if (fileID.indexOf('cloud://') === 0) {
        const r = await cloud.getTempFileURL({ fileList: [fileID] });
        const f = (r.fileList || [])[0];
        url = f && f.tempFileURL;
      }
      if (!url) return { ok: false, error: '取不到播放地址' };
      return { ok: true, url: url, title: doc.title || doc.dishName || '' };
    }

    /* ---------- 直接给 fileID 换链接（自己的视频用） ---------- */
    if (action === 'url') {
      const fileID = String(event.fileID || '');
      if (!fileID) return { ok: false, error: '缺少 fileID' };
      if (fileID.indexOf('cloud://') !== 0) return { ok: true, url: fileID };
      const r = await cloud.getTempFileURL({ fileList: [fileID] });
      const f = (r.fileList || [])[0];
      return { ok: true, url: (f && f.tempFileURL) || '' };
    }

    if (action === 'remove') {
      const id = String(event.id || '');
      if (!id) return { ok: false, error: '缺少 id' };
      const got = await db.collection(COL).doc(id).get().catch(() => null);
      const doc = got && got.data;
      if (!doc) return { ok: false, error: '视频不存在' };
      if (doc._openid !== OPENID && !isAdmin) return { ok: false, error: '只能删除自己发布的视频' };
      await db.collection(COL).doc(id).update({ data: { status: 'deleted' } });
      return { ok: true };
    }

    /* ---------- 管理员 ---------- */
    if (action === 'pending' || action === 'all') {
      if (!isAdmin) return { ok: false, error: '需要管理员权限（未配置 ADMIN_OPENIDS）' };
      const where = action === 'pending' ? { status: 'pending' } : {};
      const r = await db.collection(COL).where(where)
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
