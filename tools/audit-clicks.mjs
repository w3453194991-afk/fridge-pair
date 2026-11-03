/* 点击体检：逐页检查所有可点元素是否被遮挡 */
import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9340;
const URL = 'http://127.0.0.1:8848/index.html?v=30';
const PROFILE = 'E:/deepseek/fridge-pair/.cdp-audit';
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad', '--no-first-run', '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) break; } catch {} await sleep(120); }
const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' })).json();
const ws = await new Promise((res, rej) => { const s = new WebSocket(t.webSocketDebuggerUrl); s.onopen = () => res(s); s.onerror = rej; });
let id = 0; const pending = new Map(); const errs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map(a => a.value || a.description).join(' '));
};
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, { res, rej })); };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: URL });
await sleep(1600);
const run = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const click = async (sel) => { await run(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.click(); })()`); await sleep(280); };

await click('[data-action="loginDemo"]');
await sleep(600);
await click('[data-count="3"]');
await click('[data-action="famDone"]');
await sleep(600);
await click('[data-action="closeModal"]');

const SCAN = `(() => {
  const sels = 'button, input, select, textarea, [data-action], [data-dish], [data-food], [data-nav], [data-filter], [data-tabrec], [data-pin], [data-chip], [data-hot], [data-play], [data-week], [data-city], [data-system]';
  const tabbar = document.querySelector('.tabbar');
  const tbTop = tabbar ? tabbar.getBoundingClientRect().top : innerHeight;
  const nav = document.querySelector('.navbar');
  const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
  const out = [];
  document.querySelectorAll(sels).forEach(el => {
    if (el.closest('.modal-host') && document.getElementById('modal').hidden) return;
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // 跳过：中心落在 tabbar 下方 / 导航栏上方 / 不在视口内（滚动内容正常现象）
    if (cy > tbTop - 4 || cy < navBottom + 2 || cy < 0 || cy > innerHeight) return;
    if (el.closest('.tabbar')) return;
    if (el.classList && el.classList.contains('ghost')) return;   // 已主动让路，不算遮挡
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || el.disabled) return;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit) return;
    if (el === hit || el.contains(hit)) return;
    if (hit.classList && (hit.classList.contains('rip') || hit.classList.contains('confetti') || hit.classList.contains('flash'))) return;
    if (hit.closest('.tabbar') || hit.closest('.navbar')) return;
    out.push({
      why: '被遮挡',
      label: (el.className || el.tagName).toString().slice(0, 40) + '|' + (el.getAttribute('data-action') || el.getAttribute('data-dish') || el.getAttribute('data-nav') || ''),
      top: (hit.tagName + '.' + (hit.className || '')).slice(0, 42),
      hitHtml: (hit.outerHTML || '').slice(0, 100),
      elHtml: (el.outerHTML || '').slice(0, 100)
    });
  });
  return out;
})()`;

const pages = [];
async function scan(name) {
  await sleep(350);
  const r = await run(SCAN);
  pages.push({ name, issues: Array.isArray(r) ? r : [{ why: String(r) }] });
}

await click('[data-nav="fridge"]');
await scan('冰箱');
await click('[data-food]');
await scan('食材详情');
await click('.nav-back');

await click('[data-nav="recipe"]');
await scan('菜谱-用我的食材');
await click('[data-tabrec="all"]');
await scan('菜谱-全部');
await click('[data-tabrec="video"]');
await scan('菜谱-视频');
await click('[data-tabrec="pair"]');
await scan('菜谱-相生相克');
await click('[data-dish]');
await scan('菜品详情');
await click('.nav-back');

await click('[data-nav="plan"]');
await scan('一周配餐');
await click('[data-nav="me"]');
await scan('我的');
await click('[data-action="openHealth"]');
await scan('健康档案');
await click('.nav-back');

await click('#navSearch');
await scan('搜索');
await click('.nav-back');

await click('[data-action="openAddDish"]');
await scan('添加菜谱弹层');
await click('[data-action="closeModal"]');

await click('[data-nav="me"]');
await click('[data-action="openNearby"]');
await scan('附近超市');

console.log('=== 点击体检 ===');
let total = 0;
pages.forEach(p => {
  if (!p.issues.length) { console.log('✔ ' + p.name); return; }
  total += p.issues.length;
  console.log('✘ ' + p.name + ' (' + p.issues.length + ')');
  p.issues.slice(0, 6).forEach(i => console.log('    - ' + i.why + ' :: ' + (i.label || '') + (i.top ? '  ← 被 ' + i.top : '') + (i.hitHtml ? '\n        目标: ' + i.elHtml + '\n        遮挡: ' + i.hitHtml : '')));
});
console.log('---- 合计问题:', total);
console.log('---- JS 错误:', JSON.stringify(errs.slice(0, 5)));
writeFileSync('E:/deepseek/fridge-pair/tools/click-audit.json', JSON.stringify(pages, null, 1), 'utf8');

ws.close(); chrome.kill(); await sleep(300);
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(0);
