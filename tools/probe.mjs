/* CDP 自动化验收：注册引导 → 今日菜单 → 视频 → 搜索 → 一周配餐 → 聚餐 → 拍照 */
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
    await sleep(260);
  };
  const type = async (sel, text) => {
    await run(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if(!el) return false;
      el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await sleep(260);
  };

  const report = {};

  /* ---------- 1. 注册引导 ---------- */
  report.onbStep1 = await run(`!!document.querySelector('.onb') && document.querySelectorAll('.tabbar').length === 1 && getComputedStyle(document.querySelector('.tabbar')).display`);
  await shot('01-onboarding-1');

  await type('#onbName', '林妈妈');
  await click('[data-action="onbNext"]');
  await shot('02-onboarding-2');
  report.memberRows = await run(`document.querySelectorAll('.mrow').length`);

  await click('[data-action="onbDone"]');
  await sleep(500);
  await shot('03-fridge');
  report.registered = await run(`!!(window.DD_STORE && DD_STORE.state.family.registered)`);
  report.familyName = await run(`DD_STORE.state.family.name`);
  report.todayMeals = await run(`document.querySelectorAll('.panel .meal').length`);

  /* ---------- 2. 菜谱 + 视频 ---------- */
  await click('[data-nav="recipe"]');
  await shot('04-recipe');

  await run(`(() => {
    const btn = Array.from(document.querySelectorAll('.dish[data-dish]'))
      .find(b => b.textContent.indexOf('番茄炒蛋') >= 0);
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(320);
  await shot('05-dish');
  report.videoRows = await run(`document.querySelectorAll('.vrow').length`);
  report.platformChips = await run(`document.querySelectorAll('.vchip').length`);

  await click('.vrow[data-play]');
  await sleep(600);
  await shot('06-video');
  report.iframeSrc = await run(`(document.querySelector('.vframe iframe') || {}).src || ''`);
  await click('[data-action="closeModal"]');

  /* ---------- 3. 全局搜索 ---------- */
  await click('#navSearch');
  await shot('07-search-empty');
  await type('#globalSearch', '番茄');
  await shot('08-search-result');
  report.searchDishes = await run(`document.querySelectorAll('.dish[data-dish]').length`);

  await run(`history.length`); // noop
  await click('[data-action="back"], .nav-back').catch(() => {});
  await sleep(200);
  await click('[data-nav="fridge"]');

  /* ---------- 4. 一周配餐 ---------- */
  await click('[data-nav="plan"]');
  await click('[data-action="genWeek"]');
  await sleep(500);
  await shot('09-week');
  report.weekDays = await run(`document.querySelectorAll('.weekday').length`);

  /* ---------- 5. 聚餐定制 ---------- */
  await click('[data-nav="plan"]');
  await click('[data-action="openParty"]');
  await shot('10-party-form');

  await click('[data-party-date="fri"]');
  await click('[data-party-cuisine="川菜"]');
  await click('[data-action="partyStep"][data-k="men"][data-d="1"]');
  await click('[data-action="partyStep"][data-k="kids"][data-d="-1"]');
  await shot('11-party-form-filled');

  await click('[data-action="genParty"]');
  await sleep(400);
  await shot('12-party-result');
  report.party = await run(`(() => {
    const h = document.querySelector('.panel h3');
    return h ? h.textContent.trim() : '';
  })()`);
  report.partyMissing = await run(`document.querySelectorAll('.cart-item').length`);

  await click('[data-action="cartAdd"]');
  await sleep(300);
  report.cartCount = await run(`(DD_STORE.state.cart || []).length`);

  /* ---------- 6. 拍照入库 ---------- */
  await click('[data-nav="fridge"]');
  await click('.tab.cam');
  await shot('13-camera');
  await click('[data-action="camSample"]');
  await sleep(1500);
  await shot('14-camera-result');
  const before = await run(`document.querySelectorAll('.food').length`);
  await click('[data-action="camConfirm"]');
  await sleep(400);
  const after = await run(`document.querySelectorAll('.food').length`);
  report.added = after - before;

  /* ---------- 7. 我的 / 桌面 ---------- */
  await click('[data-nav="me"]');
  await shot('15-me');
  report.meFamilyRows = await run(`document.querySelectorAll('.ing').length`);

  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await sleep(300);
  await shot('16-desktop');
  report.desktop = await run(`(() => {
    const a = document.querySelector('#app').getBoundingClientRect();
    return { w: Math.round(a.width), left: Math.round(a.left), vw: innerWidth };
  })()`);

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
