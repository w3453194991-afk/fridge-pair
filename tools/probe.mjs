/* CDP 自动化验收脚本：截图 + 量测 + 收集控制台错误 */
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
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      if (r.ok) return;
    } catch {}
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
      } else {
        this.listeners.forEach(f => f(m));
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  on(f) { this.listeners.push(f); }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = e => reject(new Error('ws error'));
  });
}

const errors = [];
const logs = [];

(async () => {
  await waitEndpoint();
  const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' })).json();
  const ws = await connect(t.webSocketDebuggerUrl);
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
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 430, height: 932, deviceScaleFactor: 2, mobile: true
  });

  await cdp.send('Page.navigate', { url: URL });
  await sleep(1200);

  const evalJS = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };

  const shot = async (name) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(OUT + '/' + name + '.png', Buffer.from(r.data, 'base64'));
  };

  const measure = await evalJS(`(() => {
    const q = s => document.querySelector(s);
    const w = el => el ? Math.round(el.getBoundingClientRect().width) : -1;
    return {
      vw: document.documentElement.clientWidth,
      dpr: devicePixelRatio,
      bodyW: w(document.body),
      stageW: w(q('.stage')),
      appW: w(q('#app')),
      pageW: w(q('.page')),
      pageScrollW: q('.page').scrollWidth,
      docScrollW: document.documentElement.scrollWidth,
      cards: document.querySelectorAll('.food').length,
      tabs: document.querySelectorAll('.tab').length,
      tabbarW: w(q('.tabbar')),
      inner: innerWidth
    };
  })()`);

  const report = { measure, steps: [] };

  // 1 首页
  await shot('01-fridge');
  report.steps.push('fridge');

  // 2 菜谱
  await evalJS(`document.querySelector('[data-nav="recipe"]').click()`);
  await sleep(300);
  await shot('02-recipe');

  // 3 菜谱详情（第一道 "现在就能做"）
  const clickedDish = await evalJS(`(() => {
    const b = document.querySelector('.dish[data-dish]');
    if (!b) return null;
    const id = b.getAttribute('data-dish');
    b.click();
    return id;
  })()`);
  await sleep(300);
  await shot('03-dish');
  report.steps.push('dish:' + clickedDish);

  // 4 做菜弹窗
  await evalJS(`document.querySelector('[data-cook]')?.click()`);
  await sleep(400);
  await shot('04-cooked');
  report.cookedModal = await evalJS(`!!document.querySelector('.modal-host .sheet')`);
  await evalJS(`document.querySelector('[data-action="closeModal"]')?.click()`);

  // 5 一周配餐
  await evalJS(`document.querySelector('[data-nav="plan"]').click()`);
  await sleep(250);
  await shot('05-plan');
  await evalJS(`document.querySelector('[data-action="genWeek"]').click()`);
  await sleep(500);
  await shot('06-week');
  report.weekDays = await evalJS(`document.querySelectorAll('.weekday').length`);

  // 6 聚餐
  await evalJS(`document.querySelector('[data-nav="plan"]').click()`);
  await sleep(200);
  await evalJS(`document.querySelector('[data-action="openParty"]').click()`);
  await sleep(250);
  await shot('07-party');
  await evalJS(`document.querySelector('[data-action="genParty"]').click()`);
  await sleep(350);
  await shot('08-party-result');
  report.partyMissing = await evalJS(`document.querySelectorAll('.cart-item').length`);

  // 7 我的
  await evalJS(`document.querySelector('[data-nav="me"]').click()`);
  await sleep(250);
  await shot('09-me');

  // 8 拍照入库流程
  await evalJS(`document.querySelector('[data-nav="fridge"]').click()`);
  await sleep(200);
  await evalJS(`document.querySelector('.tab.cam').click()`);
  await sleep(250);
  await shot('10-camera');
  await evalJS(`document.querySelector('[data-action="camSample"]').click()`);
  await sleep(200);
  await shot('11-scan');
  await sleep(1500);
  await shot('12-result');
  report.camRows = await evalJS(`document.querySelectorAll('.res').length`);
  await evalJS(`document.querySelector('[data-action="camConfirm"]').click()`);
  await sleep(400);
  await shot('13-after-add');
  report.foodCountAfter = await evalJS(`document.querySelectorAll('.food').length`);

  // 9 食材详情
  await evalJS(`document.querySelector('.food')?.click()`);
  await sleep(300);
  await shot('14-food');
  await evalJS(`document.querySelector('[data-action="eat"]')?.click()`);
  await sleep(300);
  await shot('15-eat');

  // 10 时间旅行 +7 天
  await evalJS(`document.querySelector('[data-action="closeModal"]')?.click()`);
  await evalJS(`document.querySelector('[data-nav="me"]').click()`);
  await sleep(200);
  await evalJS(`document.querySelector('[data-action="travel"][data-days="7"]').click()`);
  await sleep(300);
  await evalJS(`document.querySelector('[data-nav="fridge"]').click()`);
  await sleep(250);
  await shot('16-travel');

  // 11 过期清理
  await evalJS(`document.querySelector('[data-action="cleanExpired"]')?.click()`);
  await sleep(300);
  await shot('17-cleanup');
  report.cleanList = await evalJS(`document.querySelectorAll('.modal-host .ing').length`);
  await evalJS(`document.querySelector('[data-action="confirmClean"]')?.click()`);
  await sleep(350);
  report.afterClean = await evalJS(`document.querySelectorAll('.food').length`);

  // 12 二次拍照更新剩余
  await evalJS(`document.querySelector('.food')?.click()`);
  await sleep(280);
  await evalJS(`document.querySelector('[data-action="repic"]')?.click()`);
  await sleep(280);
  await shot('18-update-idle');
  await evalJS(`document.querySelector('[data-action="camSample"]').click()`);
  await sleep(1600);
  await shot('19-update-result');
  report.updateBefore = await evalJS(`document.querySelector('.kv .k .val')?.textContent || ''`);
  await evalJS(`document.querySelector('[data-action="camConfirm"]').click()`);
  await sleep(400);
  report.updateAfter = await evalJS(`document.querySelector('.kv .k .val')?.textContent || ''`);

  // 13 桌面端（不模拟设备）检查
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await sleep(300);
  await shot('20-desktop');
  report.desktop = await evalJS(`(() => {
    const a = document.querySelector('#app').getBoundingClientRect();
    return { w: Math.round(a.width), left: Math.round(a.left), vw: innerWidth, vh: innerHeight };
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
  console.error('errors so far: ' + JSON.stringify(errors));
  try { chrome.kill(); } catch {}
  process.exit(1);
});
