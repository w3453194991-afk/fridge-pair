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

/* 管理员名单：环境变量 ADMIN_OPENIDS 优先，其次读 settings/admin 集合
   这样不想折腾环境变量时，调一次 claimAdmin 就能把自己设成管理员 */
const SETTINGS = 'settings';

function adminsFromEnv() {
  return String(process.env.ADMIN_OPENIDS || '')
    .split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
}

async function admins() {
  const env = adminsFromEnv();
  if (env.length) return env;
  try {
    const r = await db.collection(SETTINGS).doc('admin').get();
    const list = (r && r.data && r.data.openids) || [];
    return Array.isArray(list) ? list.filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

/* 审核模式（环境变量 REVIEW_MODE）
   manual（默认）：非管理员一律进待审
   auto          ：直接上架，靠机器检测 + 事后下架 */
function autoReview() {
  return String(process.env.REVIEW_MODE || 'manual').toLowerCase() === 'auto';
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
    nick: x.nick || '',
    views: x.views || 0,
    mine: x._openid === openid
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'list';
  const list = await admins();
  const isAdmin = list.indexOf(OPENID) >= 0;

  if (action === 'whoami') {
    return { ok: true, isAdmin: isAdmin, adminCount: list.length, source: adminsFromEnv().length ? 'env' : 'db' };
  }

  /* 一次性认领管理员：当前没有任何管理员时，调用者成为管理员 */
  if (action === 'claimAdmin') {
    if (list.length) {
      return {
        ok: false,
        error: '已有管理员：' + list.join(','),
        hint: '如需新增，直接改云函数环境变量 ADMIN_OPENIDS，或改 settings/admin 集合的 openids 数组'
      };
    }
    try {
      await db.collection(SETTINGS).doc('admin').set({ data: { openids: [OPENID], at: Date.now() } });
      return { ok: true, openid: OPENID, hint: '已设你为管理员，重新进审核页即可' };
    } catch (e) {
      return {
        ok: false,
        error: String((e && e.message) || e),
        hint: '集合 settings 可能不存在，去云开发控制台新建一个名为 settings 的集合（权限：所有用户不可读写）'
      };
    }
  }

  try {
    /* ---------- 视频库：有视频的菜（按菜聚合） ---------- */
    if (action === 'dishes') {
      const r = await db.collection(COL).where({ status: 'ok' })
        .orderBy('at', 'desc').limit(200).get();
      const map = {};
      (r.data || []).forEach(x => {
        const k = x.dishId || '';
        if (!k) return;
        if (!map[k]) {
          map[k] = { dishId: k, dishName: x.dishName || '', count: 0, views: 0, nick: x.nick || '', at: 0 };
        }
        map[k].count++;
        map[k].views += (x.views || 0);
        if ((x.at || 0) > map[k].at) {
          map[k].at = x.at || 0;
          map[k].nick = x.nick || map[k].nick;
        }
      });
      const items = Object.keys(map).map(k => map[k]).sort((a, b) => b.at - a.at);
      return { ok: true, items: items };
    }

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
      const items = (r.data || []).map(x => mapItem(x, OPENID));

      // 顺带统计每条视频的评论数 / 最新评论时间（做未读红点用）
      try {
        const _ = db.command;
        for (const it of items) {
          const cr = await db.collection('video_comments')
            .where({ videoId: it.id, status: 'ok', type: 'comment' })
            .orderBy('at', 'desc').limit(1).get().catch(() => ({ data: [] }));
          const row = (cr.data || [])[0];
          it.lastCommentAt = row ? (row.at || 0) : 0;
          it.lastCommentText = row ? String(row.text || '').slice(0, 30) : '';
          it.lastCommentNick = row ? (row.nick || '') : '';
        }
      } catch (e) {}

      return { ok: true, items: items };
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
        nick: String(event.nick || '').slice(0, 20),
        at: Date.now(),
        status: (isAdmin || autoReview()) ? 'ok' : 'pending',
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
      return { ok: true, url: url, title: doc.title || doc.dishName || '', views: doc.views || 0 };
    }

    /* ---------- 播放量 +1（前端在真正开播时调用） ---------- */
    if (action === 'view') {
      const id = String(event.id || '');
      if (!id) return { ok: false, error: '缺少 id' };
      const got = await db.collection(COL).doc(id).get().catch(() => null);
      const doc = got && got.data;
      if (!doc) return { ok: false, error: '视频不存在' };
      if (doc.status !== 'ok' && doc._openid !== OPENID && !isAdmin) {
        return { ok: false, error: '视频不可播放' };
      }
      const _ = db.command;
      await db.collection(COL).doc(id).update({ data: { views: _.inc(1) } }).catch(() => {});
      return { ok: true, views: (doc.views || 0) + 1 };
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
