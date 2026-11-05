/* ============================================================
   小程序 · 云同步
   ------------------------------------------------------------
   作用：把原本只存在手机本地的 state（冰箱/家庭/菜单…）
        按 openid 同步到云数据库，做到：
          · 换手机登录，数据还在
          · 不同微信账号各看各的，不串号

   用法（登录成功后调用一次）：
     SYNC.attach(S);        // 劫持 save，自动防抖上传
     SYNC.pull(S).then(..); // 首次拉取云端数据

   未开通云开发 / 集合不存在时，全部静默失败，退化为纯本地。
   ============================================================ */

let S_ref = null;
let attached = false;
let pushing = false;
let pending = null;
let timer = null;
let lastErr = '';

function log(...a) {
  try { console.log('[sync]', ...a); } catch (e) {}
}

function call(data) {
  return new Promise((resolve) => {
    if (!wx.cloud) { resolve({ ok: false, error: 'no cloud' }); return; }
    wx.cloud.callFunction({
      name: 'db',
      data: data,
      success: (res) => resolve((res && res.result) || { ok: false, error: 'empty result' }),
      fail: (err) => resolve({ ok: false, error: (err && err.errMsg) || 'call fail' })
    });
  });
}

/* 去掉不该上云的字段，减小体积 */
function slim(state) {
  const out = {};
  Object.keys(state || {}).forEach((k) => {
    if (k === '__proto__') return;
    out[k] = state[k];
  });
  return out;
}

function schedulePush() {
  if (!attached || !S_ref) return;
  pending = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => push(), 900);
}

function push() {
  if (!S_ref || pushing) return;
  pushing = true;
  pending = false;
  const snapshot = slim(JSON.parse(JSON.stringify(S_ref.state)));
  call({ action: 'save', data: snapshot }).then((r) => {
    pushing = false;
    if (!r.ok) {
      lastErr = r.error || '';
      log('上传失败', lastErr);
    }
    if (pending) schedulePush();
  });
}

module.exports = {
  /* 劫持 S.save，之后每次本地保存都会自动同步云端 */
  attach(S) {
    S_ref = S;
    if (attached) return;
    attached = true;
    const orig = S.save.bind(S);
    S.save = function () {
      const r = orig.apply(null, arguments);
      schedulePush();
      return r;
    };
    log('已接管保存');
  },

  /* 拉取云端数据；有则覆盖本地 state（保留 openid / 登录态） */
  pull(S) {
    S_ref = S || S_ref;
    return call({ action: 'get' }).then((r) => {
      if (!r.ok) { lastErr = r.error || ''; log('拉取失败', lastErr); return false; }
      if (!r.data || !r.data.state) { log('云端暂无数据，本次以本地为准'); return false; }

      const cloudState = r.data.state;
      const keep = {
        openid: S.state.family && S.state.family.openid,
        loggedIn: S.state.family && S.state.family.loggedIn
      };

      Object.keys(cloudState).forEach((k) => { S.state[k] = cloudState[k]; });

      // 登录态以本地为准，避免被云端旧值覆盖
      if (S.state.family) {
        if (keep.openid) S.state.family.openid = keep.openid;
        S.state.family.loggedIn = true;
      }
      try { S.saveLocal ? S.saveLocal() : null; } catch (e) {}
      log('已合并云端数据');
      return true;
    });
  },

  /* 强制上传一次（例如退出前） */
  flush() {
    return call({ action: 'save', data: slim(JSON.parse(JSON.stringify(S_ref.state))) });
  },

  status() {
    return { attached: attached, pushing: pushing, lastErr: lastErr };
  }
};
