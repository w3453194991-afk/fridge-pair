/* ============================================================
   云函数：security —— 内容安全
   ------------------------------------------------------------
   ① 文本检测（同步）  cloud.openapi.security.msgSecCheck
   ② 媒体检测（异步）  cloud.openapi.security.mediaCheckAsync
      异步结果由「消息推送」回推到本函数（见 handleCallback）

   接口：
     { action:'text',  content, scene }            → { ok, pass }
     { action:'media', fileID, mediaType }         → { ok, traceId }
   媒体回调：
     event.Event === 'wxa_media_check'
       { trace_id, result:{ suggest, label }, version }
   ============================================================ */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const CHECKS = 'media_checks';

/* ---------------- 文本检测 ---------------- */
async function checkText(content, openid, scene) {
  const text = String(content || '').trim();
  if (!text) return { ok: true, pass: true };
  try {
    const r = await cloud.openapi.security.msgSecCheck({
      version: 2,
      openid: openid,
      scene: Number(scene) || 2,     // 2 = 评论/论坛
      content: text
    });
    // errcode 0 且 result.suggest === 'pass'
    const suggest = (r && r.result && r.result.suggest) || (r && r.suggest) || 'pass';
    return { ok: true, pass: suggest === 'pass', suggest: suggest, label: (r && r.result && r.result.label) || 0 };
  } catch (e) {
    // 87014 = 内容含有违法违规内容
    const code = e && (e.errCode || e.errcode || e.code);
    if (Number(code) === 87014) return { ok: true, pass: false, suggest: 'risky', label: 0 };
    return { ok: false, error: String((e && (e.errMsg || e.message)) || e) };
  }
}

/* ---------------- 媒体检测（异步） ---------------- */
async function checkMedia(fileID, mediaType, openid, scene) {
  const file = String(fileID || '');
  if (!file) return { ok: false, error: '缺少 fileID' };

  let url = file;
  if (file.indexOf('cloud://') === 0) {
    const r = await cloud.getTempFileURL({ fileList: [file] });
    const f = (r.fileList || [])[0];
    url = f && f.tempFileURL;
  }
  if (!url) return { ok: false, error: '拿不到可访问的文件地址' };

  try {
    const res = await cloud.openapi.security.mediaCheckAsync({
      mediaUrl: url,
      mediaType: Number(mediaType) || 2,   // 1 音频 2 图片 3 视频
      version: 2,
      openid: openid,
      scene: Number(scene) || 2
    });
    const traceId = res && res.traceId;
    if (!traceId) return { ok: false, error: '未拿到 traceId' };

    await db.collection(CHECKS).add({
      data: {
        traceId: traceId,
        fileID: file,
        mediaType: Number(mediaType) || 2,
        status: 'pending',
        suggest: '',
        at: Date.now()
      }
    }).catch(() => {});

    return { ok: true, traceId: traceId };
  } catch (e) {
    return { ok: false, error: String((e && (e.errMsg || e.message)) || e) };
  }
}

/* ---------------- 异步回调 ---------------- */
async function handleCallback(event) {
  const traceId = event.trace_id || event.traceId;
  const result = event.result || {};
  const suggest = result.suggest || 'pass';
  if (!traceId) return { errcode: 0, errmsg: 'ok' };

  // 更新检测记录
  await db.collection(CHECKS).where({ traceId: traceId }).update({
    data: { status: suggest === 'pass' ? 'pass' : 'block', suggest: suggest, label: result.label || 0, at: Date.now() }
  }).catch(() => {});

  // 不通过 → 把对应视频下架
  if (suggest !== 'pass') {
    await db.collection('videos').where({ checkTrace: traceId }).update({
      data: { status: 'blocked' }
    }).catch(() => {});
  }

  return { errcode: 0, errmsg: 'ok' };
}

exports.main = async (event) => {
  // 媒体检测的异步回调
  if (event && (event.Event === 'wxa_media_check' || event.event === 'wxa_media_check')) {
    return await handleCallback(event);
  }

  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'text';

  if (action === 'text') {
    return await checkText(event.content, OPENID, event.scene);
  }
  if (action === 'media') {
    return await checkMedia(event.fileID, event.mediaType, OPENID, event.scene);
  }
  if (action === 'status') {
    const r = await db.collection(CHECKS).where({ traceId: String(event.traceId || '') }).limit(1).get();
    const d = (r.data || [])[0];
    return { ok: true, item: d ? { status: d.status, suggest: d.suggest } : null };
  }

  return { ok: false, error: '未知 action' };
};
