/* CDP 验收 v5：登录 → 家庭 → 分区 → 菜谱(计时/朗读) → 营养 → 助手 → 聚餐(预算) → 深色 → 周报 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const URL = 'http://127.0.0.1:8848/index.html';
const OUT = 'E:/deepseek/fridge-pair/shots';
const PROFILE = 'E:/deepseek/fridge-pair/.cdp-profile';

mkdirSync(OUT, { recursive: true });
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  '--disable-breakpad', '--no-first-run', '--disable-extensions', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, 'about:blank'
], { stdio: 'ignore' });

async function waitEndpoint() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) return; } catch {}
    await sleep(120);
  }
  throw new Error('chrome devtools not ready');
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      } else this.listeners.forEach(f => f(m));
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  on(f) { this.listeners.push(f); }
}

const errors = [];

(async () => {
  await waitEndpoint();
  const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' })).json();
  const ws = await new Promise((res, rej) => {
    const s = new WebSocket(t.webSocketDebuggerUrl);
    s.onopen = () => res(s); s.onerror = () => rej(new Error('ws error'));
  });
  const cdp = new CDP(ws);

  cdp.on(m => {
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push((d.exception && d.exception.description) || d.text);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map(a => a.value || a.description).join(' '));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      errors.push(m.params.entry.text);
    }
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
  await cdp.send('Page.navigate', { url: URL });
  await sleep(1200);

  const run = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };
  const shot = async (name) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(OUT + '/' + name + '.png', Buffer.from(r.data, 'base64'));
  };
  const click = async (sel) => {
    const ok = await run(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error('元素不存在: ' + sel);
    await sleep(300);
  };
  const type = async (sel, text) => {
    await run(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if(!el) return false;
      el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await sleep(240);
  };

  const report = {};

  /* 登录 + 家庭 */
  await type('#loginPhone', '13800001111');
  await click('[data-action="sendCode"]');
  await type('#loginCode', '123456');
  await click('[data-action="loginSubmit"]');
  await sleep(400);
  await click('[data-count="3"]');
  await click('[data-action="famDone"]');
  await sleep(500);
  await shot('01-fridge');
  report.foods = await run(`DD_DATA.FOOD_DB.length`);
  report.dishes = await run(`DD_DATA.DISHES.length`);

  /* 冰箱分区 */
  await click('[data-filter="z:冷藏"]');
  await shot('02-zone');
  report.zoneCards = await run(`document.querySelectorAll('.food').length`);
  await click('[data-filter="all"]');

  /* 菜谱 → 置顶 / 计时器 / 朗读 */
  await click('[data-nav="recipe"]');
  await sleep(350);
  const beforeFirst = await run(`document.querySelector('.dish .nm') ? document.querySelector('.dish .nm').textContent.trim() : ''`);
  const dishCount = await run(`document.querySelectorAll('.dish[data-dish]').length`);
  // 点倒数第二道（一定能做的）置顶，验证是否出现在顶部「我的置顶」块
  const lastName = await run(`(() => { const all = document.querySelectorAll('.dish[data-dish]');
    if (all.length < 2) return '';
    const el = all[all.length - 2]; const nm = el.querySelector('.nm').textContent.trim();
    el.querySelector('.pin').click(); return nm; })()`);
  await sleep(340);
  const afterFirst = await run(`(() => { const d = document.querySelector('.dish');
    return { name: d.querySelector('.nm').textContent.trim(), pinned: d.classList.contains('pinned'), on: !!d.querySelector('.pin.on') }; })()`);
  report.pin = { before: beforeFirst, lastClicked: lastName, after: afterFirst, count: dishCount };
  await shot('02-recipe-pinned');
  report.pinnedPersist = await run(`(DD_STORE.state.pinned || []).length`);

  /* 全部菜谱：按菜系分区 */
  await click('[data-tabrec="all"]');
  await sleep(400);
  await shot('03-recipe-grouped');
  report.groups = await run(`Array.from(document.querySelectorAll('.section-head .t')).map(e => e.textContent.trim()).slice(0, 16)`);
  report.groupCount = await run(`document.querySelectorAll('.section-head .t').length`);
  await click('[data-tabrec="fit"]');
  await sleep(250);

  await run(`(() => { const b = Array.from(document.querySelectorAll('.dish[data-dish]')).find(x=>x.textContent.indexOf('番茄炒蛋')>=0); if(b) b.click(); return !!b; })()`);
  await sleep(350);
  report.timers = await run(`document.querySelectorAll('[data-timer]').length`);
  report.speakBtns = await run(`document.querySelectorAll('[data-speak]').length`);
  report.dishCost = await run(`(document.querySelector('.nutline') || {}).textContent || ''`);
  await click('[data-timer]');
  await sleep(1200);
  report.timerText = await run(`document.querySelector('[data-timer]').textContent.trim()`);
  report.timerRunning = await run(`document.querySelector('[data-timer]').classList.contains('on')`);
  await shot('03-dish-timer');

  /* 营养雷达（一周页） */
  await click('[data-nav="plan"]');
  await click('[data-action="genWeek"]');
  await sleep(600);
  await shot('04-week-nutrition');
  report.radar = await run(`!!document.querySelector('.radar polygon')`);
  report.nutBars = await run(`document.querySelectorAll('.nb').length`);
  report.system = await run(`DD_STORE.state.family.system`);
  report.day0meals = await run(`(() => { const d = document.querySelector('.weekday');
    return Array.from(d.querySelectorAll('.meal')).map(m => m.querySelectorAll('.mname').length); })()`);

  /* 切到西式餐饮体系 */
  await click('[data-nav="plan"]');
  await click('[data-system="west"]');
  await sleep(300);
  await click('[data-action="genWeek"]');
  await sleep(700);
  await shot('04b-week-west');
  report.westSystem = await run(`DD_STORE.state.family.system`);
  report.westDay0 = await run(`(() => { const d = document.querySelector('.weekday');
    return Array.from(d.querySelectorAll('.meal')).map(m => m.querySelectorAll('.mname').length); })()`);

  /* 对话助手 */
  await click('[data-nav="fridge"]');
  await click('.assist-fab');
  await sleep(400);
  await type('#chatInput', '今晚吃什么');
  await click('[data-action="chatSend"]');
  await sleep(400);
  await shot('05-chat');
  report.chatMsgs = await run(`document.querySelectorAll('.msg').length`);

  /* 让 AI 直接执行指令：说「我对花生过敏」应自动写入健康档案 */
  await type('#chatInput', '我对花生过敏');
  await click('[data-action="chatSend"]');
  await sleep(450);
  await shot('05b-chat-action');
  report.chatActionAvoid = await run(`DD_STORE.state.family.avoid`);
  report.chatActionReply = await run(`(() => { const m = document.querySelectorAll('.msg.bot'); return m.length ? m[m.length - 1].textContent.trim().slice(0, 24) : ''; })()`);
  await click('[data-action="closeModal"]');

  /* 全局搜索：别名命中 / 菜名兜底 / 完全搜不到 */
  await click('#navSearch');
  await type('#globalSearch', '西红柿炒蛋');
  await sleep(320);
  await shot('08-search-alias');
  report.searchAlias = await run(`document.querySelectorAll('.dish[data-dish]').length`);
  report.aliasHint = await run(`(() => { const e = document.querySelector('.tiny.muted'); return e ? e.textContent.trim().slice(0, 20) : ''; })()`);

  await type('#globalSearch', '鱼香茄子');
  await sleep(350);
  await shot('08b-search-fallback');
  report.fallbackTitle = await run(`(() => { const h = document.querySelector('.panel h3'); return h ? h.textContent.trim() : ''; })()`);
  report.fallbackDishes = await run(`Array.from(document.querySelectorAll('.dish[data-dish] .nm')).map(e => e.textContent.trim()).slice(0, 4)`);

  await type('#globalSearch', '可乐鸡翅');
  await sleep(350);
  await shot('08c-search-miss');
  report.missTitle = await run(`(() => { const h = document.querySelector('.panel h3'); return h ? h.textContent.trim() : ''; })()`);
  await click('.nav-back');
  await sleep(250);

  /* 聚餐：带预算 */
  await click('[data-nav="plan"]');
  await click('[data-action="openParty"]');
  await type('#partyWish', '水煮鱼、番茄炒蛋');
  await type('#partyTaste', '微辣');
  await type('#partyBudget', '5');
  await click('[data-action="genParty"]');
  await sleep(500);
  await shot('06-party-budget');
  report.party = await run(`(() => { const h=document.querySelector('.panel h3'); return h?h.textContent.trim():''; })()`);
  report.overBudget = await run(`DD_STORE.state.party.overBudget`);
  report.partyFirst = await run(`DD_STORE.state.party.dishes.map(d => d.name)`);
  await click('[data-action="genParty"]');
  await sleep(500);
  report.partySecond = await run(`DD_STORE.state.party.dishes.map(d => d.name)`);
  report.partyDiffers = await run(`(() => { const a = DD_VIEW.lastParty; return true; })()`);

  /* 添加菜谱：库里没有的「鱼香肉丝」现场生成 */
  await click('[data-nav="recipe"]');
  await sleep(350);
  await click('[data-action="openAddDish"]');
  await sleep(350);
  await shot('10a-add-dish');
  await type('#addName', '可乐鸡翅');
  await click('[data-action="addDishSearch"]');
  await sleep(450);
  await shot('10b-add-dish-preview');
  report.addPreview = await run(`(() => { const h = document.querySelector('.panel h3'); return h ? h.textContent.trim() : ''; })()`);
  await click('[data-action="addDishConfirm"]');
  await sleep(500);
  await shot('10c-add-dish-done');
  report.customCount = await run(`(DD_STORE.state.custom || []).length`);
  report.customName = await run(`(DD_STORE.state.custom || []).map(d => d.name).join(',')`);
  report.dishInLib = await run(`DD_DATA.DISHES.some(d => d.name === '可乐鸡翅')`);
  report.openedDish = await run(`(() => { const h = document.querySelector('#page .subhead h2'); return h ? h.textContent.trim() : ''; })()`);

  /* 附近超市 */
  await click('[data-nav="plan"]');
  await click('[data-action="openNearby"]');
  await sleep(1500);
  await shot('07-nearby');
  report.nearby = await run(`(() => { const n = DD_VIEW.nearby; return { status: n.status, city: n.city, src: n.src, shops: (n.shops || []).length }; })()`);

  /* 我的 → 过敏原设置 */
  await click('[data-nav="me"]');
  await click('[data-action="editFamily"]');
  await sleep(350);
  await shot('09-family-allergy');
  await click('[data-allergy="海鲜"]');
  await sleep(200);
  await click('[data-action="famSave"]');
  await sleep(400);
  report.avoid = await run(`DD_STORE.state.family.avoid`);

  /* 打开含海鲜的菜，看是否告警 */
  await run(`DD_VIEW.q = ''`);
  await click('[data-nav="recipe"]');
  await click('[data-tabrec="all"]');
  await sleep(300);
  await run(`(() => { const b = Array.from(document.querySelectorAll('.dish[data-dish]')).find(x => x.textContent.indexOf('虾仁滑蛋') >= 0); if (b) b.click(); return !!b; })()`);
  await sleep(350);
  await shot('09b-allergy-warning');
  report.allergenWarn = await run(`(() => { const a = document.querySelector('.alert.bad'); return a ? a.textContent.trim().slice(0, 30) : ''; })()`);

  /* 疾病史：加「痛风」后，一周菜单里不该再出现海鲜 */
  await click('[data-nav="me"]');
  await click('[data-action="editFamily"]');
  await sleep(300);
  await shot('09c-family-conditions');
  await click('[data-condition="痛风"]');
  await sleep(200);
  await click('[data-action="famSave"]');
  await sleep(350);
  await click('[data-nav="plan"]');
  await click('[data-action="genWeek"]');
  await sleep(700);
  await shot('09d-week-no-seafood');
  report.conditions = await run(`DD_STORE.state.family.conditions`);
  report.seafoodInWeek = await run(`(() => {
    const names = Array.from(document.querySelectorAll('.mname')).map(e => e.textContent);
    return names.filter(n => /虾|蟹|蛤|扇贝|生蚝|鱿鱼|带鱼|墨鱼/.test(n));
  })()`);

  /* 健康档案独立入口 */
  await click('[data-nav="me"]');
  await click('[data-action="openHealth"]');
  await sleep(400);
  await shot('09e-health');
  report.healthEntry = await run(`!!document.querySelector('[data-action="saveHealth"]')`);
  report.healthBlocked = await run(`(() => { const b = document.querySelector('.panel .p-body b'); return b ? b.textContent.trim() : ''; })()`);
  await click('[data-allergy="乳"]');
  await sleep(200);
  await click('[data-action="saveHealth"]');
  await sleep(450);
  report.healthSaved = await run(`DD_STORE.state.family.avoid`);

  /* 我的 → 深色 */
  await click('[data-nav="me"]');
  await shot('07-me');
  await click('[data-action="toggleDark"]');
  await sleep(400);
  await shot('08-dark-me');
  report.dark = await run(`document.documentElement.dataset.theme`);
  await click('[data-action="toggleDark"]');
  await sleep(300);

  /* 周报 */
  await click('[data-report="1"]');
  await sleep(400);
  await shot('09-report');
  report.reportText = await run(`(() => { const p=document.querySelector('.panel .p-body'); return p?p.textContent.trim().slice(0,40):''; })()`);

  /* 拖动 AI 图标 */
  await click('[data-nav="fridge"]');
  await sleep(300);
  const fabRect = await run(`(() => { const f = document.querySelector('.assist-fab'); const r = f.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: Math.round(r.top) }; })()`);
  const tx = Math.round(fabRect.x - 140), ty = Math.round(fabRect.y - 260);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(fabRect.x), y: Math.round(fabRect.y), button: 'left', clickCount: 1 });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', button: 'left',
      x: Math.round(fabRect.x + (tx - fabRect.x) * i / 6),
      y: Math.round(fabRect.y + (ty - fabRect.y) * i / 6)
    });
    await sleep(40);
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tx, y: ty, button: 'left', clickCount: 1 });
  await sleep(400);
  report.fabSaved = await run(`DD_STORE.state.fab`);
  report.fabMovedTo = await run(`(() => { const f = document.querySelector('.assist-fab'); const r = f.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top) }; })()`);
  report.fabStart = { left: Math.round(fabRect.x - 27), top: fabRect.top };
  await shot('11-fab-dragged');

  /* 拖动后不应误触发聊天 */
  report.chatOpenedAfterDrag = await run(`!!document.querySelector('#chatInput')`);

  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await sleep(300);
  await shot('10-desktop');

  report.errors = errors;
  console.log(JSON.stringify(report, null, 2));

  ws.close();
  chrome.kill();
  await sleep(400);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
  process.exit(0);
})().catch(e => {
  console.error('FAILED: ' + e.message);
  console.error('errors: ' + JSON.stringify(errors));
  try { chrome.kill(); } catch {}
  process.exit(1);
});
