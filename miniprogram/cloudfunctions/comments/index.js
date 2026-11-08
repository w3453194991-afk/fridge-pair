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

/* 管理员判定：本函数没配 ADMIN_OPENIDS 时，回退到 videos 云函数的 whoami
   这样只需要在 videos 里配一次，其他函数自动生效 */
async function isAdminUser(openid) {
  if (admins().indexOf(openid) >= 0) return true;
  if (!admins().length) {
    try {
      const r = await cloud.callFunction({ name: 'videos', data: { action: 'whoami' } });
      return !!(r && r.result && r.result.isAdmin);
    } catch (e) { return false; }
  }
  return false;
}

/* 评论通知：给视频作者发一条订阅消息
   环境变量：
     COMMENT_TMPL_ID       模板 ID（必填）
     COMMENT_TMPL_FIELDS   字段映射，JSON，可省略
       例：{"thing1":"dish","thing2":"text","time3":"time"}
       可用的值：dish（菜名）nick（评论人）text（评论内容）time（时间）
                 tips（固定提示语）result（固定"评论成功"）who（评论人前缀）
   不配则静默跳过 */
function buildNotifyData(video, doc) {
  const dish = String(video.dishName || video.title || '你的视频').slice(0, 20);
  const who = String(doc.nick || '有人').slice(0, 10);
  const msg = String(doc.text || (doc.images && doc.images.length ? '[图片]' : '')).slice(0, 20);
  const now = new Date(Date.now() + 8 * 3600 * 1000);   // 北京时间
  const timeText = now.getUTCFullYear() + '-' +
    String(now.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(now.getUTCDate()).padStart(2, '0') + ' ' +
    String(now.getUTCHours()).padStart(2, '0') + ':' +
    String(now.getUTCMinutes()).padStart(2, '0');

  const dict = {
    dish: dish,
    nick: who,
    text: msg,
    time: timeText,
    tips: '点击可查看评论和互动内容',
    result: '评论成功',
    who: who + '：' + msg
  };

  let map = { thing1: 'dish', thing2: 'who', time3: 'time' };
  try {
    const raw = String(process.env.COMMENT_TMPL_FIELDS || '').trim();
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') map = parsed;
    }
  } catch (e) {}

  const data = {};
  Object.keys(map).forEach(k => {
    const v = dict[map[k]];
    if (v !== undefined && v !== '') data[k] = { value: String(v) };
  });
  return data;
}

async function notifyAuthor(videoId, fromOpenid, doc) {
  const tmplId = String(process.env.COMMENT_TMPL_ID || '').trim();
  if (!tmplId) return { ok: false, skipped: '未配置模板' };

  const vid = await db.collection('videos').doc(videoId).get().catch(() => null);
  const video = vid && vid.data;
  if (!video) return { ok: false, skipped: '视频不存在' };
  if (video._openid === fromOpenid) return { ok: false, skipped: '自己评论自己' };

  try {
    await cloud.openapi.subscribeMessage.send({
      touser: video._openid,
      templateId: tmplId,
      page: 'pages/player/index?id=' + String(video.dishId || ''),
      miniprogramState: 'formal',
      data: buildNotifyData(video, doc)
    });
    return { ok: true };
  } catch (e) {
    // 43101 = 用户未订阅；其他错误也不影响评论本身
    return { ok: false, error: String((e && (e.errMsg || e.message)) || e) };
  }
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
  const isAdmin = await isAdminUser(OPENID);

  try {
    if (action === 'whoami') {
      return { ok: true, isAdmin: isAdmin };
    }

    /* 管理员自测：给自己发一条通知，验证模板字段对不对 */
    if (action === 'testNotify') {
      if (!isAdmin) return { ok: false, error: '需要管理员权限' };
      const tmplId = String(process.env.COMMENT_TMPL_ID || '').trim();
      if (!tmplId) return { ok: false, error: '未配置 COMMENT_TMPL_ID' };
      const fakeVideo = { dishName: '番茄炒蛋', dishId: 'tomato-egg', title: '番茄炒蛋 的做法', _openid: OPENID };
      const fakeDoc = { nick: '小林', text: '这个糖色怎么炒的？', images: [] };
      const data = buildNotifyData(fakeVideo, fakeDoc);
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: OPENID,
          templateId: tmplId,
          page: 'pages/player/index?id=tomato-egg',
          miniprogramState: 'developer',
          data: data
        });
        return { ok: true, sent: data };
      } catch (e) {
        return {
          ok: false,
          error: String((e && (e.errMsg || e.message)) || e),
          sent: data,
          hint: '43101 = 你还没订阅；47003 = 字段名/长度不符合模板'
        };
      }
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

      /* 图片先用 imgSecCheck 同步检测（≤1MB 有效）
         · 全部通过 → 直接上架
         · 有不通过 → 拒绝
         · 检测服务异常 → 降级进人工待审 */
      let imgVerdict = 'none';
      if (images.length) {
        try {
          const r = await cloud.callFunction({
            name: 'security',
            data: { action: 'imgs', fileIDs: images }
          });
          const out = (r && r.result) || {};
          if (out.ok && out.pass === false) return { ok: false, error: '图片未通过安全检测' };
          if (out.ok && out.pass === true) {
            const degraded = (out.results || []).some(x => x && x.degraded);
            imgVerdict = degraded ? 'degraded' : 'pass';
          } else {
            imgVerdict = 'degraded';
          }
        } catch (e) {
          imgVerdict = 'degraded';
        }
      }

      // 审核模式：manual（默认）→ 图片未通过机器检测就等人工；auto → 直接上架
      const autoMode = String(process.env.REVIEW_MODE || 'manual').toLowerCase() === 'auto';
      const needReview = images.length > 0 && imgVerdict !== 'pass' && !isAdmin && !autoMode;

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

      // 通知视频作者（不阻塞主流程，失败静默）
      if (doc.status === 'ok' && !doc.replyTo) {
        notifyAuthor(videoId, OPENID, doc).catch(() => {});
      }

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
