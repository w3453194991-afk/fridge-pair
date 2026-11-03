/* 从 Wikimedia Commons 下载菜品/食材照片到 img/ */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const sb = { console }; sb.window = sb;
vm.createContext(sb);
vm.runInContext(readFileSync('E:/deepseek/fridge-pair/js/data.js', 'utf8'), sb, { filename: 'data.js' });
const D = sb.DD_DATA;

const DISH_Q = {
  '番茄炒蛋': 'tomato scrambled eggs', '蒜蓉菠菜': 'garlic spinach stir fry', '西兰花炒牛肉': 'broccoli beef',
  '番茄鸡蛋面': 'tomato egg noodle soup', '菠菜豆腐汤': 'spinach tofu soup', '莲藕排骨汤': 'lotus root pork rib soup',
  '豉汁蒸排骨': 'steamed pork ribs black bean', '香菇豆腐煲': 'tofu mushroom stew', '清炒油菜': 'stir fried bok choy',
  '胡萝卜排骨汤': 'carrot pork rib soup', '蒜香鸡胸': 'grilled chicken breast', '牛奶燕麦粥': 'oatmeal porridge milk',
  '宫保鸡丁': 'kung pao chicken', '麻婆豆腐': 'mapo tofu', '鱼香肉丝': 'yuxiang shredded pork',
  '回锅肉': 'twice cooked pork', '手抓羊肉': 'lamb chops boiled', '葱爆羊肉': 'scallion lamb stir fry',
  '西湖牛肉羹': 'beef soup thick', '东坡肉': 'dongpo pork', '蒜蓉粉丝蒸扇贝': 'steamed scallops garlic',
  '韩式泡菜炒饭': 'kimchi fried rice', '泡菜豆腐汤': 'kimchi tofu stew', '韩式炸鸡': 'korean fried chicken',
  '石锅拌饭': 'bibimbap', '西班牙海鲜饭': 'paella', '奶油蘑菇汤': 'cream of mushroom soup',
  '凯撒沙拉': 'caesar salad', '香煎三文鱼': 'pan seared salmon', '奶油培根意面': 'carbonara',
  '英式早餐': 'english breakfast', '番茄肉酱意面': 'spaghetti bolognese', '泰式冬阴功': 'tom yum soup',
  '绿咖喱鸡': 'green curry chicken', '越南春卷': 'vietnamese spring rolls', '咖喱鸡': 'chicken curry',
  '南瓜浓汤': 'pumpkin soup', '苹果酸奶杯': 'yogurt apple parfait', '皮蛋瘦肉粥': 'century egg congee',
  '红烧茄子': 'braised eggplant', '糖醋排骨': 'sweet and sour pork ribs', '蛋炒饭': 'egg fried rice',
  '京酱肉丝': 'shredded pork with sweet bean sauce', '干煸豆角': 'dry fried green beans',
  '酸辣土豆丝': 'hot and sour shredded potato', '香菇滑鸡': 'steamed chicken mushroom',
  '番茄鸡蛋汤': 'tomato egg drop soup', '手撕包菜': 'hand torn cabbage', '地三鲜': 'di san xian vegetables',
  '红烧肉': 'braised pork belly', '可乐鸡翅': 'cola chicken wings'
};

const FOOD_Q = {
  '番茄': 'tomato', '土豆': 'potato', '大白菜': 'napa cabbage', '黄瓜': 'cucumber', '胡萝卜': 'carrot',
  '洋葱': 'onion', '青椒': 'green bell pepper', '茄子': 'eggplant', '菠菜': 'spinach', '西兰花': 'broccoli',
  '香菇': 'shiitake mushroom', '莲藕': 'lotus root', '冬瓜': 'winter melon', '南瓜': 'pumpkin',
  '鸡蛋': 'chicken eggs', '牛奶': 'milk glass', '酸奶': 'yogurt', '豆腐': 'tofu', '五花肉': 'pork belly',
  '猪里脊': 'pork tenderloin', '排骨': 'pork ribs', '牛里脊': 'beef steak raw', '牛腩': 'beef brisket',
  '鸡胸肉': 'raw chicken breast', '鸡腿': 'chicken legs', '鸡翅': 'chicken wings', '虾': 'shrimp raw',
  '虾仁': 'peeled shrimp', '鲈鱼': 'sea bass fish', '三文鱼': 'salmon fillet', '大米': 'rice grains',
  '挂面': 'dry noodles', '面包': 'bread loaf', '苹果': 'apple', '香蕉': 'banana', '柠檬': 'lemon'
};

const OUT_D = 'E:/deepseek/fridge-pair/img/d';
const OUT_F = 'E:/deepseek/fridge-pair/img/f';
mkdirSync(OUT_D, { recursive: true });
mkdirSync(OUT_F, { recursive: true });

const UA = 'FridgePairDemo/1.0 (educational hackathon)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchFile(q) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search'
    + '&gsrsearch=' + encodeURIComponent(q) + '&gsrnamespace=6&gsrlimit=6'
    + '&prop=imageinfo&iiprop=url|size&iiurlwidth=520&format=json';
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  const j = await r.json();
  const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
  if (!pages.length) return null;
  const cands = pages.filter(p => p.imageinfo && p.imageinfo[0])
    .sort((a, b) => (a.index || 99) - (b.index || 99));
  for (const p of cands) {
    const ii = p.imageinfo[0];
    if (!/\.(jpg|jpeg|png)$/i.test(p.title)) continue;
    return { url: ii.thumburl || ii.url, title: p.title };
  }
  return null;
}

async function grab(q, dest) {
  if (existsSync(dest)) return 'skip';
  try {
    const hit = await searchFile(q);
    if (!hit) return 'none';
    const r = await fetch(hit.url, { headers: { 'User-Agent': UA } });
    if (!r.ok) return 'http' + r.status;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 4000) return 'tiny';
    writeFileSync(dest, buf);
    return 'ok ' + hit.title.replace('File:', '');
  } catch (e) { return 'err ' + e.message.slice(0, 40); }
}

const log = [];
for (const d of D.DISHES) {
  const q = DISH_Q[d.name] || null;
  if (!q) { log.push(['DISH', d.name, 'NO_MAP']); continue; }
  const res = await grab(q, OUT_D + '/' + d.id + '.jpg');
  log.push(['DISH', d.name, res]);
  await sleep(120);
}
for (const [name, q] of Object.entries(FOOD_Q)) {
  const f = D.FOOD_MAP[name];
  if (!f) { log.push(['FOOD', name, 'NO_FOOD']); continue; }
  const res = await grab(q, OUT_F + '/' + f.id + '.jpg');
  log.push(['FOOD', name, res]);
  await sleep(120);
}

writeFileSync('E:/deepseek/fridge-pair/tools/fetch-log.txt', log.map(l => l.join(' | ')).join('\n'), 'utf8');
const okN = log.filter(l => l[2].startsWith('ok')).length;
console.log('完成：', okN + '/' + log.length, '张');
log.filter(l => !l[2].startsWith('ok')).forEach(l => console.log('  ', l.join(' | ')));
