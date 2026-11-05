/* 把 web 版核心（零 DOM）拷进小程序 lib/，并在顶部注入垫片变量 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SRC = 'E:/deepseek/fridge-pair/js';
const DST = 'E:/deepseek/fridge-pair/miniprogram/lib';
mkdirSync(DST, { recursive: true });

const PROLOGUE = `/* 由 tools/build-mp.mjs 自动生成，请勿直接修改 */
const window = require('./shim.js');
const localStorage = window.localStorage;
`;

const files = ['data.js', 'engine.js', 'store.js'];
for (const f of files) {
  const code = readFileSync(`${SRC}/${f}`, 'utf8');
  writeFileSync(`${DST}/${f}`, PROLOGUE + code, 'utf8');
  console.log('copied', f, (code.length / 1024).toFixed(1) + 'KB');
}
console.log('done');
