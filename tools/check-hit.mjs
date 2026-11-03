import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9338;
const URL = 'http://127.0.0.1:8848/index.html?v=26';
const PROFILE = 'E:/deepseek/fridge-pair/.cdp-hit';
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad', '--no-first-run', '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) break; } catch {} await sleep(120); }
const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' })).json();
const ws = await new Promise((res, rej) => { const s = new WebSocket(t.webSocketDebuggerUrl); s.onopen = () => res(s); s.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, { res, rej })); };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: URL });
await sleep(1600);
const run = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true }); if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

await run(`document.querySelector('[data-action="loginDemo"]').click()`);
await sleep(800);
await run(`document.querySelector('[data-count="3"]') && document.querySelector('[data-count="3"]').click()`);
await sleep(300);
await run(`document.querySelector('[data-action="famDone"]') && document.querySelector('[data-action="famDone"]').click()`);
await sleep(700);
await run(`document.querySelector('[data-action="closeModal"]') && document.querySelector('[data-action="closeModal"]').click()`);
await sleep(400);

console.log(await run(`(() => {
  const b = document.querySelector('[data-action="shoot"]');
  const r = b.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const top = document.elementFromPoint(cx, cy);
  return JSON.stringify({
    rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    topEl: top ? (top.className || top.tagName) : 'none',
    insideButton: !!(top && b.contains(top)),
    toast: (() => { const t = document.getElementById('toast'); const cs = getComputedStyle(t); const tr = t.getBoundingClientRect(); return { op: cs.opacity, pe: cs.pointerEvents, w: Math.round(tr.width), h: Math.round(tr.height), bottom: Math.round(innerHeight - tr.bottom) }; })(),
    modalHidden: document.getElementById('modal').hidden
  }, null, 1);
})()`));

await run(`document.querySelector('[data-action="shoot"]').click()`);
await sleep(600);
console.log('click 后弹层:', await run(`!document.getElementById('modal').hidden`), await run(`(() => { const h = document.querySelector('.sheet-head .t'); return h ? h.textContent : ''; })()`));
ws.close(); chrome.kill(); await sleep(300);
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(0);
