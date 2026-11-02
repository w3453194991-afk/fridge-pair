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

  /* 菜谱 → 计时器 / 朗读 */
  await click('[data-nav="recipe"]');
  await run(`(() => { const b = Array.from(document.querySelectorAll('.dish[data-dish]')).find(x=>x.textContent.indexOf('番茄炒蛋')>=0); if(b) b.click(); return !!b; })()`);
  await sleep(350);
  report.timers = await run(`document.querySelectorAll('[data-timer]').length`);
  report.speakBtns = await run(`document.querySelectorAll('[data-speak]').length`);
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

  /* 对话助手 */
  await click('[data-nav="fridge"]');
  await click('.assist-fab');
  await sleep(400);
  await type('#chatInput', '今晚吃什么');
  await click('[data-action="chatSend"]');
  await sleep(400);
  await shot('05-chat');
  report.chatMsgs = await run(`document.querySelectorAll('.msg').length`);
  await click('[data-action="closeModal"]');

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
