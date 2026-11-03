/* 生成抓图清单：{kind, id, name, q} */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const sb = { console }; sb.window = sb;
vm.createContext(sb);
vm.runInContext(readFileSync('E:/deepseek/fridge-pair/js/data.js', 'utf8'), sb, { filename: 'data.js' });
const D = sb.DD_DATA;

const DISH_Q = {
  '番茄炒蛋': 'tomato scrambled eggs', '蒜蓉菠菜': 'garlic spinach', '西兰花炒牛肉': 'broccoli beef',
  '番茄鸡蛋面': 'tomato egg noodles', '菠菜豆腐汤': 'spinach tofu soup', '莲藕排骨汤': 'lotus root pork ribs soup',
  '豉汁蒸排骨': 'steamed pork ribs', '香菇豆腐煲': 'tofu mushroom', '清炒油菜': 'bok choy stir fry',
  '胡萝卜排骨汤': 'carrot pork rib soup', '蒜香鸡胸': 'chicken breast grilled', '牛奶燕麦粥': 'oatmeal milk',
  '宫保鸡丁': 'kung pao chicken', '麻婆豆腐': 'mapo tofu', '鱼香肉丝': 'shredded pork stir fry',
  '回锅肉': 'twice cooked pork', '手抓羊肉': 'boiled lamb', '葱爆羊肉': 'lamb scallion',
  '西湖牛肉羹': 'beef soup', '东坡肉': 'braised pork belly', '蒜蓉粉丝蒸扇贝': 'steamed scallops',
  '韩式泡菜炒饭': 'kimchi fried rice', '泡菜豆腐汤': 'kimchi stew', '韩式炸鸡': 'korean fried chicken',
  '石锅拌饭': 'bibimbap', '西班牙海鲜饭': 'paella', '奶油蘑菇汤': 'cream mushroom soup',
  '凯撒沙拉': 'caesar salad', '香煎三文鱼': 'salmon grilled', '奶油培根意面': 'carbonara pasta',
  '英式早餐': 'full english breakfast', '番茄肉酱意面': 'spaghetti bolognese', '泰式冬阴功': 'tom yum',
  '绿咖喱鸡': 'green curry', '越南春卷': 'spring rolls', '咖喱鸡': 'chicken curry',
  '南瓜浓汤': 'pumpkin soup', '苹果酸奶杯': 'yogurt parfait', '皮蛋瘦肉粥': 'congee',
  '红烧茄子': 'braised eggplant', '糖醋排骨': 'sweet sour pork ribs', '蛋炒饭': 'fried rice egg',
  '京酱肉丝': 'shredded pork', '干煸豆角': 'green beans stir fry', '酸辣土豆丝': 'shredded potato',
  '香菇滑鸡': 'chicken mushroom', '番茄鸡蛋汤': 'tomato egg soup', '手撕包菜': 'cabbage stir fry',
  '地三鲜': 'eggplant potato pepper', '红烧肉': 'hong shao rou', '可乐鸡翅': 'chicken wings',
  '青椒土豆丝': 'shredded potato stir fry', '水蒸蛋': 'steamed egg custard', '洋葱炒蛋': 'scrambled eggs onion',
  '番茄牛腩': 'tomato beef brisket', '冬瓜排骨汤': 'winter melon soup', '凉拌黄瓜': 'cucumber salad',
  '玉米胡萝卜汤': 'corn carrot soup', '韭菜炒蛋': 'scrambled eggs chive', '茄子豆角': 'eggplant green beans',
  '虾仁滑蛋': 'shrimp scrambled eggs', '香煎带鱼': 'fried hairtail fish', '意面番茄肉酱': 'spaghetti bolognese pasta',
  '培根鸡蛋三明治': 'bacon egg sandwich', '山药排骨汤': 'pork rib soup', '番茄肉酱拌面': 'noodles tomato sauce',
  '白切鸡': 'white cut chicken', '清蒸鲈鱼': 'steamed sea bass', '糖醋里脊': 'sweet sour pork',
  '木须肉': 'moo shu pork', '剁椒蒸鲈鱼': 'steamed fish chili', '农家小炒肉': 'stir fried pork chili',
  '锅包肉': 'guo bao rou', '香煎牛排': 'steak pan fried', '日式照烧鸡腿': 'teriyaki chicken',
  '味噌汤': 'miso soup', '亲子丼': 'oyakodon', '泰式冬阴功汤': 'tom yum soup',
  '印度咖喱鸡': 'chicken curry indian', '墨西哥牛肉卷饼': 'beef burrito'
};

const FOOD_Q = {
  '番茄': 'tomato', '土豆': 'potato', '大白菜': 'napa cabbage', '黄瓜': 'cucumber', '胡萝卜': 'carrot',
  '洋葱': 'onion', '青椒': 'green pepper', '茄子': 'eggplant', '菠菜': 'spinach', '西兰花': 'broccoli',
  '香菇': 'shiitake', '莲藕': 'lotus root', '冬瓜': 'winter melon', '南瓜': 'pumpkin',
  '鸡蛋': 'chicken eggs', '牛奶': 'milk', '酸奶': 'yogurt', '豆腐': 'tofu', '五花肉': 'pork belly',
  '猪里脊': 'pork meat', '排骨': 'pork ribs', '牛里脊': 'beef raw', '牛腩': 'beef brisket',
  '鸡胸肉': 'chicken breast raw', '鸡腿': 'chicken legs', '鸡翅': 'chicken wings', '虾': 'shrimp',
  '虾仁': 'shrimp peeled', '鲈鱼': 'sea bass', '三文鱼': 'salmon', '大米': 'rice grains',
  '挂面': 'noodles dry', '面包': 'bread', '苹果': 'apple', '香蕉': 'banana', '柠檬': 'lemon'
};

const out = [];
for (const d of D.DISHES) {
  const q = DISH_Q[d.name];
  if (q) out.push({ kind: 'd', id: d.id, name: d.name, q });
}
for (const [name, q] of Object.entries(FOOD_Q)) {
  const f = D.FOOD_MAP[name];
  if (f) out.push({ kind: 'f', id: f.id, name, q });
}
writeFileSync('E:/deepseek/fridge-pair/tools/photo-queries.json', JSON.stringify(out, null, 1), 'utf8');
console.log('清单条数:', out.length, '（菜品', out.filter(o => o.kind === 'd').length, '/ 食材', out.filter(o => o.kind === 'f').length, '）');
