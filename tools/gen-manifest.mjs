/* 扫描 img/ 生成前端清单 js/photos.js，避免 404 */
import { readdirSync, writeFileSync, existsSync } from 'node:fs';

const root = 'E:/deepseek/fridge-pair';
const scan = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => /\.(jpg|jpeg|png)$/i.test(f)).map(f => f.replace(/\.(jpg|jpeg|png)$/i, ''));
};
const d = scan(root + '/img/d');
const f = scan(root + '/img/f');
const body = '/* 自动生成：可用的大图清单（由 tools/gen-manifest.mjs 产出） */\n'
  + 'window.DD_PHOTOS = ' + JSON.stringify({ d: d.reduce((o, k) => (o[k] = 1, o), {}), f: f.reduce((o, k) => (o[k] = 1, o), {}) }) + ';\n';
writeFileSync(root + '/js/photos.js', body, 'utf8');
console.log('清单：菜品', d.length, '张 / 食材', f.length, '张');
