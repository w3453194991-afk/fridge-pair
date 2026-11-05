/* ============================================================
   隐私授权守卫
   ------------------------------------------------------------
   微信规定：调用相机、相册、位置等隐私接口前，必须先让用户
   同意《用户隐私保护指引》（在小程序后台上传）。

   不处理的后果：
     · 开发者工具里正常
     · 正式版里 wx.chooseMedia / wx.getLocation 直接 fail
       （errMsg 里带 "privacy permission is not authorized"）

   用法：
     privacy.ensure(() => { ...调用相机... });
   ============================================================ */

function ensure(cb, onDeny) {
  const done = (ok) => {
    if (ok) { cb && cb(); }
    else if (onDeny) { onDeny(); }
    else {
      wx.showModal({
        title: '需要你的同意',
        content: '用相机拍照、获取位置前，需要你同意《用户隐私保护指引》。',
        confirmText: '去同意',
        success: (r) => {
          if (r.confirm) {
            wx.openPrivacyContract ? wx.openPrivacyContract({}) : null;
          }
        }
      });
    }
  };

  // 老基础库没有隐私接口，直接放行
  if (!wx.getPrivacySetting) { done(true); return; }

  wx.getPrivacySetting({
    success: (res) => {
      if (!res.needAuthorization) { done(true); return; }
      if (!wx.requirePrivacyAuthorize) { done(true); return; }
      wx.requirePrivacyAuthorize({
        success: () => done(true),
        fail: () => done(false)
      });
    },
    fail: () => done(true)
  });
}

module.exports = { ensure: ensure };
