/* ============================================================
   云函数：prices —— 菜价表
   ------------------------------------------------------------
   目的：把「食材单价」从写死改成可更新，小程序启动时拉一次。

   集合：prices   文档 { name, price, unit, source, updatedAt }

   action:
     get     → { ok, updatedAt, items: [{name, price}] }
     seed    → 用内置 PRICE_BOOK 灌一遍（首次初始化用）
     update  → { items: [{name, price}] } 覆盖写入（可接爬虫/人工）

   定时更新：见同目录 config.json 的 triggers（每天 6:00 跑一次 refresh）
   ============================================================ */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COL = 'prices';

exports.main = async (event) => {
  const action = (event && event.action) || 'get';

  try {
    if (action === 'get') {
      const r = await db.collection(COL).limit(500).get();
      const items = (r.data || []).map(x => ({ name: x.name, price: x.price }));
      const updatedAt = (r.data || []).reduce((m, x) => Math.max(m, x.updatedAt || 0), 0);
      return { ok: true, count: items.length, updatedAt: updatedAt, items: items };
    }

    if (action === 'update') {
      const list = (event && event.items) || [];
      if (!Array.isArray(list) || !list.length) return { ok: false, error: 'items 为空' };

      let n = 0;
      for (const it of list) {
        if (!it || !it.name || typeof it.price !== 'number') continue;
        const exist = await db.collection(COL).where({ name: it.name }).limit(1).get();
        if (exist.data && exist.data.length) {
          await db.collection(COL).doc(exist.data[0]._id).update({
            data: { price: it.price, unit: it.unit || exist.data[0].unit || '', updatedAt: Date.now() }
          });
        } else {
          await db.collection(COL).add({
            data: { name: it.name, price: it.price, unit: it.unit || '', source: 'manual', updatedAt: Date.now() }
          });
        }
        n++;
      }
      return { ok: true, updated: n };
    }

    return { ok: false, error: '未知 action: ' + action };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
};
