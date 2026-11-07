/* ============================================================
   云函数：comments —— 共享视频的评论 / 弹幕 / 回复 / 图片
   ------------------------------------------------------------
   集合：video_comments
     { videoId, dishId, openid, nick, text, images:[fileID],
       type:'comment'|'danmaku', t:秒, replyTo, at, status }

   接口：
     { action:'list', videoId }                      → { comments, danmaku }
     { action:'add', videoId, text, images, type, t, replyTo }
     { action:'remove', id }
   ============================================================ */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const COL = 'video_comments';

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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'list';

  try {
    if (action === 'list') {
      const videoId = String(event.videoId || '');
      if (!videoId) return { ok: false, error: '缺少 videoId' };
      const r = await db.collection(COL).where({ videoId: videoId, status: 'ok' })
        .orderBy('at', 'asc').limit(200).get();
      const rows = (r.data || []).map(x => ({
        id: x._id,
        nick: x.nick || '冰箱用户',
        text: x.text || '',
        images: x.images || [],
        type: x.type || 'comment',
        t: x.t || 0,
        replyTo: x.replyTo || '',
        at: x.at || 0,
        mine: x.openid === OPENID
      }));
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
      if (!doc) return { ok: false, error: '不存在' };
      if (doc.openid !== OPENID) return { ok: false, error: '只能删自己的' };
      await db.collection(COL).doc(id).update({ data: { status: 'deleted' } });
      return { ok: true };
    }

    return { ok: false, error: '未知 action' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
};
