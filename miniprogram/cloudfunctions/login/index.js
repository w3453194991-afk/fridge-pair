/* ============================================================
   云函数：login
   ------------------------------------------------------------
   返回当前用户的 openid（微信身份），用它当账号，不需要手机号。
   个人主体小程序不能使用「手机号快速验证」，这是唯一零成本方案。

   部署：右键 cloudfunctions/login → 上传并部署（云端安装依赖）
   ============================================================ */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const ctx = cloud.getWXContext();
  return {
    ok: true,
    openid: ctx.OPENID || '',
    appid: ctx.APPID || '',
    unionid: ctx.UNIONID || '',
    env: ctx.ENV || ''
  };
};
