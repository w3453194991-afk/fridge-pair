/* ============================================================
   登录态兜底
   ------------------------------------------------------------
   问题：真机偶尔会把主存储里的 state 重置（缓存被清、JSON 损坏等），
        导致 family.loggedIn 变回 false，每次都回登录页。

   做法：登录时额外写一份轻量会话（含家庭成员快照）。
        启动时如果主 state 丢了登录态，但会话还在，就自动恢复。
   ============================================================ */

const KEY = 'ddm.session';

function save(fam, openid) {
  try {
    wx.setStorageSync(KEY, {
      openid: openid || (fam && fam.openid) || '',
      at: Date.now(),
      fam: fam ? {
        name: fam.name,
        members: fam.members,
        avoid: fam.avoid,
        conditions: fam.conditions,
        system: fam.system,
        onboarded: fam.onboarded,
        openid: fam.openid
      } : null
    });
  } catch (e) {}
}

function read() {
  try { return wx.getStorageSync(KEY) || null; } catch (e) { return null; }
}

function clear() {
  try { wx.removeStorageSync(KEY); } catch (e) {}
}

module.exports = { save: save, read: read, clear: clear };
