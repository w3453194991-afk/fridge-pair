/* CDP 验收 v4：登录 → 家庭档案 → 首页 → 视频库 → 搜索 → 聚餐(手输菜) → 拍照 → 我的 → 退出 */
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
  await sleep(1100);

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
    await sleep(280);
  };
  const type = async (sel, text) => {
    await run(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if(!el) return false;
      el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await sleep(240);
  };

  const report = {};

  /* ---------- 1. 登录 ---------- */
  report.loginScreen = await run(`!!document.querySelector('.login')`);
  await shot('01-login');

  await type('#loginPhone', '13800001111');
  await click('[data-action="sendCode"]');
  await shot('02-login-code');
  report.codeHint = await run(`!!document.querySelector('.code-hint')`);

  await type('#loginCode', '123456');
  await click('[data-action="loginSubmit"]');
  await sleep(400);

  /* ---------- 2. 家庭档案（几口人） ---------- */
  report.familyStep = await run(`document.querySelectorAll('.cnt').length`);
  await shot('03-family-setup');
  await click('[data-count="3"]');
  report.memberRows3 = await run(`document.querySelectorAll('.mrow').length`);
  await shot('04-family-3');

  await click('[data-action="famDone"]');
  await sleep(500);
  await shot('05-fridge');
  report.loggedIn = await run(`DD_STORE.state.family.loggedIn`);
  report.members = await run(`DD_STORE.state.family.members.length`);
  report.todayMeals = await run(`document.querySelectorAll('.panel .meal').length`);

  /* ---------- 3. 视频库 ---------- */
  await click('[data-nav="recipe"]');
  await click('[data-tabrec="video"]');
  await shot('06-video-lib');
  report.vcards = await run(`document.querySelectorAll('.vcard').length`);
  report.platformRows = await run(`document.querySelectorAll('.vrowline').length`);

  await click('.vcover');
  await sleep(400);
  await shot('07-video-player');
  await click('.vposter');
  await sleep(400);
  report.iframe = await run(`(document.querySelector('.vframe iframe')||{}).src||''`);
  await click('[data-action="closeModal"]');

  /* ---------- 4. 搜索 ---------- */
  await click('#navSearch');
  await type('#globalSearch', '番茄');
  await shot('08-search');
  report.searchDishes = await run(`document.querySelectorAll('.dish[data-dish]').length`);
  await click('.nav-back');

  /* ---------- 5. 聚餐：手输想吃的菜 ---------- */
  await click('[data-nav="plan"]');
  await click('[data-action="openParty"]');
  await shot('09-party-form');
  await type('#partyWish', '水煮鱼、番茄炒蛋');
  await type('#partyTaste', '微辣，朋友爱吃川菜');
  await click('[data-party-cuisine="川菜"]');
  await shot('10-party-form-filled');

  await click('[data-action="genParty"]');
  await sleep(400);
  await shot('11-party-result');
  report.party = await run(`(() => { const h=document.querySelector('.panel h3'); return h?h.textContent.trim():''; })()`);
  report.wishMiss = await run(`(() => {
    const rows = Array.from(document.querySelectorAll('.ing .l')).map(e=>e.textContent.trim());
    return rows.filter(x=>x.indexOf('🍜')>=0);
  })()`);

  /* ---------- 6. 我的（已登录） ---------- */
  await click('[data-nav="me"]');
  await shot('12-me');
  report.meLogged = await run(`!!document.querySelector('.acct') && !!document.querySelector('[data-action="logout"]')`);

  await click('[data-action="logout"]');
  await sleep(300);
  await shot('13-logout');
  report.afterLogout = await run(`!!document.querySelector('.login') && !DD_STORE.state.family.loggedIn`);

  /* 桌面宽度 */
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await sleep(300);
  await shot('14-desktop');
  report.desktop = await run(`(() => { const a=document.querySelector('#app').getBoundingClientRect();
    return { w: Math.round(a.width), left: Math.round(a.left), vw: innerWidth }; })()`);

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
