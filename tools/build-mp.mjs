/* 把 web 版核心（零 DOM）拷进小程序 lib/，保持单一数据源 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const SRC = 'E:/deepseek/fridge-pair/js';
const DST = 'E:/deepseek/fridge-pair/miniprogram/lib';
mkdirSync(DST, { recursive: true });

const files = ['data.js', 'engine.js', 'store.js'];
for (const f of files) {
  const code = readFileSync(`${SRC}/${f}`, 'utf8');
  // 顶部加一行说明，内容保持原样（IIFE 依赖 window，由 shim 提供）
  const banner = `/* 由 tools/build-mp.mjs 从 js/${f} 自动复制，请勿在此直接修改 */\n`;
  writeFileSync(`${DST}/${f}`, banner + code, 'utf8');
  console.log('copied', f, (code.length / 1024).toFixed(1) + 'KB');
}
console.log('done');
