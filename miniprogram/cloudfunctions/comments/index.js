/* ============================================================
   云函数：comments —— 共享视频的评论 / 弹幕 / 回复 / 图片
   ------------------------------------------------------------
   集合：video_comments
     { videoId, dishId, openid, nick, text, images:[fileID],
       type:'comment'|'danmaku', t:秒, replyTo, at, status }

   规则：
     · 纯文字 → 走 msgSecCheck，通过即上架（status ok）
     · 带图片 → 先 pending，等管理员审核
     · 管理员自己发的 → 直接 ok

   环境变量：
     ADMIN_OPENIDS  管理员 openid，逗号分隔

   接口：
     { action:'list', videoId }
     { action:'add', videoId, text, images, type, t, replyTo }
     { action:'remove', id }
     { action:'pendingImages' }            管理员
     { action:'approve', id } / 'block', id 管理员
   ============================================================ */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const COL = 'video_comments';

function admins() {
  return String(process.env.ADMIN_OPENIDS || '')
    .split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
}

async function textCheck(content) {
  const t = String(content || '').trim();
  if (!t) return { pass: true };
  try {
    const r = await cloud.callFunction({ name: 'security', data: { action: 'text', content: t, scene: 2 } });
    const out = (r && r.result) || {};
    if (out.ok === false) return { pass: true, degraded: true };  // 检测服务异常时放行
    return { pass: out.pass !== false };
  } catch (e) {
    return { pass: true, degraded: true };
  }
}

function mapRow(x, openid) {
  return {
    id: x._id,
    nick: x.nick || '冰箱用户',
    text: x.text || '',
    images: x.images || [],
    type: x.type || 'comment',
    t: x.t || 0,
    replyTo: x.replyTo || '',
    at: x.at || 0,
    status: x.status || 'ok',
    dishId: x.dishId || '',
    mine: x.openid === openid
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'list';
  const isAdmin = admins().indexOf(OPENID) >= 0;

  try {
    if (action === 'whoami') {
      return { ok: true, isAdmin: isAdmin };
    }

    if (action === 'list') {
      const videoId = String(event.videoId || '');
      if (!videoId) return { ok: false, error: '缺少 videoId' };

      const r = await db.collection(COL).where({ videoId: videoId, status: 'ok' })
        .orderBy('at', 'asc').limit(200).get();
      let rows = (r.data || []).map(x => mapRow(x, OPENID));

      // 自己待审的图片评论也返回（标 pending，自己能看见）
      const own = await db.collection(COL)
        .where({ videoId: videoId, openid: OPENID, status: 'pending' })
        .orderBy('at', 'asc').limit(20).get().catch(() => ({ data: [] }));
      const ownRows = (own.data || []).map(x => mapRow(x, OPENID));
      ownRows.forEach(o => { if (!rows.some(x => x.id === o.id)) rows.push(o); });

      return {
        ok: true,
        comments: rows.filter(x => x.type === 'comment'),
        danmaku: rows.filter(x => x.type === 'danmaku')
      };
    }

    if (action === 'add') {
      const videoId = String(event.videoId || '');
      const text = String(event.text || '').trim();
      const images = Array.isArray(event.images) ? event.images.filter(Boolean).slice(0, 3) : [];
      if (!videoId) return { ok: false, error: '缺少 videoId' };
      if (!text && !images.length) return { ok: false, error: '说点什么吧' };
      if (text.length > 200) return { ok: false, error: '最多 200 字' };

      if (text) {
        const c = await textCheck(text);
        if (!c.pass) return { ok: false, error: '内容未通过安全检测' };
      }

      // 带图一律先进待审（管理员除外）
      const needReview = images.length > 0 && !isAdmin;

      const doc = {
        videoId: videoId,
        dishId: String(event.dishId || ''),
        openid: OPENID,
        nick: String(event.nick || '').slice(0, 20) || '冰箱用户',
        text: text,
        images: images,
        type: event.type === 'danmaku' ? 'danmaku' : 'comment',
        t: Number(event.t) || 0,
        replyTo: String(event.replyTo || ''),
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

    /* ---------- 管理员 ---------- */
    if (action === 'pendingImages') {
      if (!isAdmin) return { ok: false, error: '需要管理员权限' };
      const r = await db.collection(COL).where({ status: 'pending' })
        .orderBy('at', 'desc').limit(50).get();
      return { ok: true, items: (r.data || []).map(x => mapRow(x, OPENID)) };
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
