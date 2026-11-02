/* ============================================================
   冰箱对对碰 · 数据层
   1) FOOD_DB   食材知识库（标准保质期 / 储存 / 单价）
   2) DISHES    菜谱库（下厨房级步骤）
   3) PAIRS     营养相生相克规则
   4) SEED      示例冰箱（首次打开时的 18 件食材）
   ============================================================ */
(function (w) {
  'use strict';

  /* ---------- 1. 食材知识库 ---------- */
  // shelf: 冷藏可存放天数（默认储存方式）；price: 单价（元/单位）
  const FOOD_DB = [
    { name: '番茄',   emoji: '🍅', cat: '蔬菜',   unit: '个',  shelf: 5,   price: 2.5,  storage: '冷藏' },
    { name: '西兰花', emoji: '🥦', cat: '蔬菜',   unit: '颗',  shelf: 5,   price: 5,    storage: '冷藏' },
    { name: '菠菜',   emoji: '🥬', cat: '蔬菜',   unit: '把',  shelf: 3,   price: 3.5,  storage: '冷藏' },
    { name: '土豆',   emoji: '🥔', cat: '蔬菜',   unit: '个',  shelf: 20,  price: 1.5,  storage: '阴凉' },
    { name: '青椒',   emoji: '🫑', cat: '蔬菜',   unit: '个',  shelf: 7,   price: 1.2,  storage: '冷藏' },
    { name: '胡萝卜', emoji: '🥕', cat: '蔬菜',   unit: '根',  shelf: 14,  price: 1,    storage: '冷藏' },
    { name: '大蒜',   emoji: '🧄', cat: '蔬菜',   unit: '头',  shelf: 30,  price: 1.5,  storage: '阴凉' },
    { name: '香菇',   emoji: '🍄', cat: '蔬菜',   unit: '朵',  shelf: 5,   price: 0.8,  storage: '冷藏' },
    { name: '豆腐',   emoji: '🍥', cat: '豆制品', unit: '块',  shelf: 3,   price: 3,    storage: '冷藏' },
    { name: '牛里脊', emoji: '🥩', cat: '肉类',   unit: 'g',   shelf: 3,   price: 0.12, storage: '冷藏' },
    { name: '排骨',   emoji: '🍖', cat: '肉类',   unit: 'g',   shelf: 2,   price: 0.06, storage: '冷藏' },
    { name: '鸡翅',   emoji: '🍗', cat: '肉类',   unit: 'g',   shelf: 2,   price: 0.045,storage: '冷藏' },
    { name: '三文鱼', emoji: '🐟', cat: '肉类',   unit: 'g',   shelf: 1,   price: 0.18, storage: '冷藏' },
    { name: '鸡蛋',   emoji: '🥚', cat: '蛋奶',   unit: '枚',  shelf: 30,  price: 1.2,  storage: '冷藏' },
    { name: '牛奶',   emoji: '🥛', cat: '蛋奶',   unit: '盒',  shelf: 7,   price: 3.5,  storage: '冷藏' },
    { name: '酸奶',   emoji: '🥣', cat: '蛋奶',   unit: '杯',  shelf: 10,  price: 4,    storage: '冷藏' },
    { name: '苹果',   emoji: '🍎', cat: '水果',   unit: '个',  shelf: 14,  price: 3,    storage: '冷藏' },
    { name: '香蕉',   emoji: '🍌', cat: '水果',   unit: '根',  shelf: 5,   price: 1.5,  storage: '阴凉' },
    { name: '柠檬',   emoji: '🍋', cat: '水果',   unit: '个',  shelf: 20,  price: 2,    storage: '冷藏' },
    { name: '挂面',   emoji: '🍜', cat: '主食',   unit: '把',  shelf: 180, price: 4,    storage: '常温' },
    { name: '大米',   emoji: '🍚', cat: '主食',   unit: 'kg',  shelf: 365, price: 6,    storage: '常温' },
    { name: '燕麦',   emoji: '🌾', cat: '主食',   unit: 'g',   shelf: 50,  price: 0.03, storage: '常温' }
  ];

  const FOOD_MAP = {};
  FOOD_DB.forEach(f => { FOOD_MAP[f.name] = f; });

  /* ---------- 2. 菜谱库 ---------- */
  const DISHES = [
    {
      id: 'tomato-egg', name: '番茄炒蛋', emoji: '🍳', minutes: 15, level: '新手',
      meals: ['早', '午', '晚'], tags: ['快手', '家常', '全家适合'],
      ingredients: [{ name: '番茄', qty: 2 }, { name: '鸡蛋', qty: 3 }],
      seasonings: ['盐 2 g', '白糖 3 g', '食用油 15 ml', '小葱 1 根（可选）'],
      prep: ['番茄顶部划十字，浇开水烫 30 秒，撕掉外皮后切滚刀块。',
             '鸡蛋打散，加 1 勺清水和一小撮盐，搅到没有明显蛋筋。'],
      steps: [
        { heat: '中火', text: '锅烧到微微冒烟，倒 10 ml 油，油面起细波纹后倒入蛋液。' },
        { heat: '中火', text: '蛋液边缘定型时用铲子从外向内推，约 20 秒，七成熟就盛出——这一步决定嫩不嫩。' },
        { heat: '大火', text: '补 5 ml 油，下番茄块翻炒 1 分钟，加白糖 3 g 和一小撮盐，把红色汤汁压出来。' },
        { heat: '大火', text: '倒回鸡蛋，快速翻 15 秒让蛋块裹上汤汁，撒葱花，关火出锅。' }
      ],
      tips: ['番茄要出汁靠的是糖盐同下，不是加水。', '鸡蛋七成熟就出锅，回锅时还会再熟一次。'],
      nutrition: '番茄红素遇油吸收率可提升约 3 倍；鸡蛋提供完整氨基酸，软嫩好嚼。',
      pair: '番茄红素（脂溶）+ 优质蛋白 → 吸收翻倍'
    },
    {
      id: 'beef-broccoli', name: '西兰花炒牛肉', emoji: '🥘', minutes: 25, level: '进阶',
      meals: ['午', '晚'], tags: ['补铁', '高蛋白'],
      ingredients: [{ name: '牛里脊', qty: 200 }, { name: '西兰花', qty: 1 }],
      seasonings: ['生抽 10 ml', '蚝油 8 g', '淀粉 5 g', '蒜末 2 瓣', '食用油 15 ml', '黑胡椒 少许'],
      prep: ['牛肉逆着纹理切 2 mm 薄片，加生抽、淀粉、5 ml 油抓匀，腌 10 分钟。',
             '西兰花掰小朵，淡盐水泡 5 分钟，冲洗干净。'],
      steps: [
        { heat: '大火', text: '水烧开加一小撮盐和几滴油，西兰花下锅焯 40 秒，捞出立刻过凉水，颜色才翠绿。' },
        { heat: '大火', text: '锅烧热倒油，油热后下牛肉片快速划散，变色即盛出（约 40 秒）。' },
        { heat: '大火', text: '锅内留底油爆香蒜末，下西兰花翻炒 30 秒，加蚝油翻匀。' },
        { heat: '大火', text: '倒回牛肉，淋 10 ml 生抽，撒黑胡椒，快速翻 20 秒出锅。' }
      ],
      tips: ['牛肉一定要逆纹切，顺纹切会嚼不动。', '西兰花焯水别超过 1 分钟，否则维 C 流失。'],
      nutrition: '血红素铁 + 维生素 C，铁吸收率可提高 2~3 倍，适合经期女性和老人补铁。',
      pair: '铁（牛里脊）+ 维C（西兰花）→ 铁吸收 ×2'
    },
    {
      id: 'milk-oats', name: '牛奶燕麦粥', emoji: '🥣', minutes: 8, level: '新手',
      meals: ['早'], tags: ['早餐', '控糖', '10 分钟'],
      ingredients: [{ name: '牛奶', qty: 1 }, { name: '燕麦', qty: 50 }],
      seasonings: ['蜂蜜 1 小勺（可选）', '坚果碎 少许'],
      prep: ['燕麦倒进小锅，加 100 ml 清水先浸 1 分钟，煮出来更绵。'],
      steps: [
        { heat: '中火', text: '燕麦加水煮开，转小火煮 3 分钟，边煮边搅防粘底。' },
        { heat: '小火', text: '倒入牛奶，保持微沸再煮 2 分钟，表面起细泡即可。' },
        { heat: '关火', text: '关火后加蜂蜜（水温降至 60℃ 以下再加，保留活性成分），撒坚果碎。' }
      ],
      tips: ['牛奶别大火滚，容易糊底且蛋白变性结皮。', '想更稠就多煮 1 分钟，别加淀粉。'],
      nutrition: 'β-葡聚糖 + 钙，延缓餐后血糖上升，饱腹感可持续到中午。',
      pair: '燕麦 β-葡聚糖 + 牛奶钙 → 稳血糖、更耐饿'
    },
    {
      id: 'tomato-noodle', name: '番茄鸡蛋面', emoji: '🍜', minutes: 15, level: '新手',
      meals: ['早', '午', '晚'], tags: ['一锅出', '孩子爱吃'],
      ingredients: [{ name: '番茄', qty: 1 }, { name: '鸡蛋', qty: 2 }, { name: '挂面', qty: 1 }],
      seasonings: ['盐 2 g', '生抽 5 ml', '香油 3 滴', '葱花 少许'],
      prep: ['番茄切小块（不用去皮，炒软后皮会卷起好挑），鸡蛋打散。'],
      steps: [
        { heat: '大火', text: '锅里少油，鸡蛋炒成块盛出。' },
        { heat: '大火', text: '下番茄炒 2 分钟到软烂出汁，加 500 ml 开水烧滚。' },
        { heat: '中火', text: '下挂面煮 3 分钟（按包装时间减 30 秒），加盐和生抽。' },
        { heat: '小火', text: '倒回鸡蛋煮 30 秒，淋香油、撒葱花出锅。' }
      ],
      tips: ['先炒番茄再加水，汤才红亮。', '面条别煮到全软，泡在汤里还会继续熟。'],
      nutrition: '一碗含碳水和优质蛋白，加个青菜更均衡；适合孩子和牙口不好的老人。',
      pair: '番茄 + 鸡蛋 + 主食 → 一餐营养齐全'
    },
    {
      id: 'spinach-tofu', name: '菠菜豆腐汤', emoji: '🍲', minutes: 15, level: '新手',
      meals: ['午', '晚'], tags: ['清淡', '补钙', '需焯水'],
      ingredients: [{ name: '菠菜', qty: 0.5 }, { name: '豆腐', qty: 0.5 }],
      seasonings: ['盐 2 g', '白胡椒 少许', '香油 2 滴', '姜丝 少许'],
      prep: ['菠菜洗净切段。', '豆腐切 2 cm 小块，用淡盐水泡 5 分钟去豆腥。'],
      steps: [
        { heat: '大火', text: '水烧开，菠菜下锅焯 20 秒马上捞出——这一步是去掉草酸，别省。' },
        { heat: '中火', text: '另起锅加 600 ml 水，放姜丝和豆腐块，小火煮 4 分钟。' },
        { heat: '中火', text: '下焯好的菠菜煮 1 分钟，加盐和白胡椒。' },
        { heat: '关火', text: '滴 2 滴香油出锅。' }
      ],
      tips: ['菠菜必须焯水，草酸会影响钙吸收。', '豆腐小火煮，大火容易碎。'],
      nutrition: '菠菜维 K + 豆腐钙；焯水后草酸去除，钙吸收不受影响。',
      pair: '维K（菠菜）+ 钙（豆腐）→ 骨骼更结实'
    },
    {
      id: 'pepper-potato', name: '青椒土豆丝', emoji: '🌶️', minutes: 15, level: '新手',
      meals: ['午', '晚'], tags: ['下饭', '快手'],
      ingredients: [{ name: '土豆', qty: 2 }, { name: '青椒', qty: 2 }],
      seasonings: ['盐 2 g', '白醋 5 ml', '蒜末 2 瓣', '干辣椒 2 个（可选）'],
      prep: ['土豆去皮切细丝，泡清水 5 分钟洗掉表面淀粉，捞出沥干。',
             '青椒去籽切丝。'],
      steps: [
        { heat: '大火', text: '锅烧热倒油，下蒜末和干辣椒爆香 10 秒。' },
        { heat: '大火', text: '下土豆丝大火快炒 1 分半，沿锅边淋 5 ml 白醋，丝才脆。' },
        { heat: '大火', text: '下青椒丝翻炒 40 秒，加盐翻匀即可出锅。' }
      ],
      tips: ['土豆丝泡水去淀粉，炒出来才根根分明不粘锅。', '醋要沿锅边淋，遇热汽化才香。'],
      nutrition: '土豆提供钾和维 C，青椒补充维 C；少油快炒保留脆感，适合控油家庭。',
      pair: '维C（青椒）+ 钾（土豆）→ 少油也够味'
    },
    {
      id: 'rib-carrot', name: '胡萝卜排骨汤', emoji: '🍲', minutes: 70, level: '进阶',
      meals: ['午', '晚'], tags: ['煲汤', '补钙', '老人友好'],
      ingredients: [{ name: '排骨', qty: 400 }, { name: '胡萝卜', qty: 2 }],
      seasonings: ['姜 3 片', '料酒 10 ml', '盐 3 g', '枸杞 一小把'],
      prep: ['排骨冷水下锅，加料酒和 1 片姜，水开后撇净浮沫，煮 2 分钟捞出冲净。',
             '胡萝卜滚刀切块。'],
      steps: [
        { heat: '大火', text: '砂锅加 1.5 L 热水，放排骨和姜片，大火烧开。' },
        { heat: '小火', text: '转最小火盖盖炖 40 分钟，汤面只冒小泡，不要大滚。' },
        { heat: '小火', text: '下胡萝卜继续炖 20 分钟，至排骨能轻松脱骨。' },
        { heat: '关火', text: '加盐调味（出锅前再放，肉更嫩），撒枸杞焖 3 分钟。' }
      ],
      tips: ['焯水一定冷水下锅，血水才出得干净。', '盐最后放，早放肉会柴。'],
      nutrition: '胡萝卜素为脂溶性，配排骨的脂肪吸收更好；汤里钙和胶原对老人友好。',
      pair: '胡萝卜素（脂溶）+ 肉类脂肪 → 吸收更好'
    },
    {
      id: 'mushroom-tofu', name: '香菇豆腐煲', emoji: '🍄', minutes: 20, level: '新手',
      meals: ['午', '晚'], tags: ['素菜', '鲜', '低脂'],
      ingredients: [{ name: '香菇', qty: 6 }, { name: '豆腐', qty: 1 }, { name: '胡萝卜', qty: 0.5 }],
      seasonings: ['生抽 10 ml', '蚝油 8 g', '淀粉水 少许', '葱花 少许'],
      prep: ['香菇去蒂切十字花刀，豆腐切厚片。', '胡萝卜切片。'],
      steps: [
        { heat: '中火', text: '豆腐片下锅两面煎至微黄（每面约 2 分钟），盛出。' },
        { heat: '大火', text: '下香菇和胡萝卜炒 2 分钟，炒出香味。' },
        { heat: '中火', text: '加 150 ml 水、生抽、蚝油，放回豆腐，盖盖焖 5 分钟。' },
        { heat: '大火', text: '淋薄淀粉水收汁，撒葱花出锅。' }
      ],
      tips: ['豆腐先煎再焖，不易碎且更入味。', '香菇打十字花刀更容易吸汁。'],
      nutrition: '香菇多糖 + 豆腐植物蛋白，低脂高鲜，适合三高人群。',
      pair: '香菇多糖 + 植物蛋白 → 鲜味不靠油'
    },
    {
      id: 'garlic-spinach', name: '蒜蓉菠菜', emoji: '🥬', minutes: 8, level: '新手',
      meals: ['午', '晚'], tags: ['3 分钟上桌', '补铁'],
      ingredients: [{ name: '菠菜', qty: 1 }],
      seasonings: ['蒜 3 瓣', '盐 2 g', '食用油 10 ml'],
      prep: ['菠菜洗净，根部切开便于受热均匀。蒜切末。'],
      steps: [
        { heat: '大火', text: '水烧开，菠菜焯 20 秒捞出沥干（去草酸）。' },
        { heat: '中火', text: '锅下油，小火爆香蒜末至微黄。' },
        { heat: '大火', text: '下菠菜大火快炒 30 秒，加盐翻匀立刻出锅。' }
      ],
      tips: ['菠菜别久炒，30 秒足够，否则发黄出水。', '蒜末小火爆，大火会苦。'],
      nutrition: '菠菜富含叶酸、铁和维 K，热量极低，是控糖控脂家庭的常备菜。',
      pair: '叶酸 + 铁 → 贫血人群友好'
    },
    {
      id: 'steamed-egg', name: '水蒸蛋', emoji: '🥚', minutes: 12, level: '新手',
      meals: ['早', '午'], tags: ['幼儿', '老人', '零失败'],
      ingredients: [{ name: '鸡蛋', qty: 2 }],
      seasonings: ['盐 1 g', '温水 180 ml', '生抽 3 ml', '香油 1 滴'],
      prep: ['鸡蛋打散，加盐，倒入约 1.5 倍蛋液的温水（40℃ 左右），搅匀。'],
      steps: [
        { heat: '中火', text: '蛋液过筛 2 次去掉气泡，倒入碗中，盖上盘子或包保鲜膜。' },
        { heat: '中火', text: '水开后上锅，中小火蒸 8 分钟，关火焖 2 分钟。' },
        { heat: '关火', text: '取出淋生抽和香油，撒葱花。' }
      ],
      tips: ['水温 40℃ 左右、比例 1:1.5，蒸出来最嫩。', '一定要盖盖子，否则表面会蜂窝。'],
      nutrition: '蒸制最大程度保留蛋白质和卵磷脂，几乎不需要咀嚼，适合幼儿和老人。',
      pair: '优质蛋白 → 好消化好吸收'
    },
    {
      id: 'apple-yogurt', name: '苹果酸奶杯', emoji: '🍨', minutes: 3, level: '新手',
      meals: ['早'], tags: ['早餐', '3 分钟', '益生菌'],
      ingredients: [{ name: '酸奶', qty: 1 }, { name: '苹果', qty: 1 }],
      seasonings: ['蜂蜜 少许（可选）', '燕麦脆 少许'],
      prep: ['苹果洗净带皮切小丁（皮里果胶更多）。'],
      steps: [
        { heat: '无火', text: '苹果丁铺杯底。' },
        { heat: '无火', text: '倒入酸奶，撒燕麦脆。' },
        { heat: '无火', text: '想吃甜可淋半小勺蜂蜜，拌匀即食。' }
      ],
      tips: ['苹果现切现拌，避免氧化发黄。', '酸奶别选"风味发酵乳"，糖多。'],
      nutrition: '果胶 + 益生菌，帮肠道做早课；冷藏酸奶取出放 5 分钟再吃更温和。',
      pair: '果胶（苹果）+ 益生菌（酸奶）→ 肠道更顺'
    },
    {
      id: 'pan-salmon', name: '香煎三文鱼', emoji: '🐟', minutes: 18, level: '进阶',
      meals: ['午', '晚'], tags: ['高蛋白', 'Omega-3'],
      ingredients: [{ name: '三文鱼', qty: 200 }, { name: '柠檬', qty: 0.5 }],
      seasonings: ['盐 2 g', '黑胡椒 少许', '黄油 5 g', '迷迭香 少许（可选）'],
      prep: ['三文鱼用厨房纸把表面水分彻底吸干（这步决定能不能煎出脆皮）。', '两面撒盐和黑胡椒，静置 5 分钟。'],
      steps: [
        { heat: '中火', text: '平底锅烧热倒少许油，鱼皮朝下放入，用铲子轻压 10 秒防卷。' },
        { heat: '中火', text: '煎 3 分钟不要动，看到侧面熟到 2/3 再翻面。' },
        { heat: '中小火', text: '翻面煎 2 分钟，加黄油和迷迭香，用勺子把黄油浇在鱼身上。' },
        { heat: '关火', text: '出锅静置 2 分钟，挤柠檬汁。' }
      ],
      tips: ['表面必须擦干才下锅，否则是"煮"不是"煎"。', '中心留一点粉嫩最嫩，全熟会柴。'],
      nutrition: 'Omega-3 脂肪酸 + 优质蛋白，一周吃 2 次对心脑血管友好。',
      pair: 'Omega-3 + 维C（柠檬）→ 抗炎又解腻'
    }
  ];

  /* ---------- 3. 相生相克 ---------- */
  const PAIRS = [
    { a: '牛里脊', b: '西兰花', type: 'syn', title: '铁 + 维C，吸收翻倍', dish: 'beef-broccoli',
      desc: '牛肉里的血红素铁遇到西兰花的维生素 C，铁吸收率可提高 2~3 倍，是经典的补铁组合。' },
    { a: '番茄', b: '鸡蛋', type: 'syn', title: '脂溶番茄红素 + 优质蛋白', dish: 'tomato-egg',
      desc: '番茄红素是脂溶性的，和蛋黄脂肪一起炒，吸收率提升约 3 倍；酸甜口也最下饭。' },
    { a: '牛奶', b: '燕麦', type: 'syn', title: '稳血糖的早餐组合', dish: 'milk-oats',
      desc: '燕麦 β-葡聚糖延缓碳水吸收，牛奶补钙补蛋白，早餐吃这一碗能扛到中午。' },
    { a: '胡萝卜', b: '排骨', type: 'syn', title: '胡萝卜素遇脂肪才好吸收', dish: 'rib-carrot',
      desc: '胡萝卜素是脂溶性的，用排骨汤里的脂肪带着一起吃，吸收率比生啃高得多。' },
    { a: '苹果', b: '酸奶', type: 'syn', title: '果胶 + 益生菌', dish: 'apple-yogurt',
      desc: '苹果果胶是益生菌的"口粮"，两者同吃对肠道菌群更友好，比单喝酸奶更有效。' },
    { a: '菠菜', b: '鸡蛋', type: 'syn', title: '叶酸 + 优质蛋白', dish: 'garlic-spinach',
      desc: '菠菜的叶酸和铁，搭配鸡蛋的蛋白质，贫血人群和孕产妇都适合（菠菜记得先焯水）。' },
    { a: '牛奶', b: '菠菜', type: 'con', title: '草酸 + 钙，影响吸收', dish: null,
      desc: '菠菜中的草酸会和牛奶的钙结合成草酸钙，影响钙吸收。建议间隔 1 小时以上，或菠菜先焯水。' },
    { a: '牛奶', b: '柠檬', type: 'con', title: '果酸让酪蛋白凝结', dish: null,
      desc: '柠檬的果酸会让牛奶中的酪蛋白凝结成块，肠胃敏感的人容易腹胀。想喝柠檬水建议和牛奶错开。' },
    { a: '菠菜', b: '豆腐', type: 'cau', title: '先焯水，就能放心同吃', dish: 'spinach-tofu',
      desc: '这是流传很广的"相克"说法。其实草酸怕热水——菠菜焯 20 秒，草酸去掉大半，菠菜豆腐汤照样能喝。' }
  ];

  /* ---------- 4. 示例冰箱数据 ---------- */
  // d: 距离过期还有多少天（负数表示已过期）
  const SEED = [
    { name: '番茄',   qty: 2,   d: 1 },
    { name: '牛奶',   qty: 1,   d: 1 },
    { name: '酸奶',   qty: 2,   d: -2 },
    { name: '菠菜',   qty: 1,   d: 2 },
    { name: '排骨',   qty: 500, d: 2 },
    { name: '西兰花', qty: 1,   d: 3 },
    { name: '豆腐',   qty: 1,   d: 3 },
    { name: '牛里脊', qty: 300, d: 4 },
    { name: '香菇',   qty: 6,   d: 4 },
    { name: '青椒',   qty: 2,   d: 5 },
    { name: '胡萝卜', qty: 3,   d: 9 },
    { name: '苹果',   qty: 4,   d: 10 },
    { name: '鸡蛋',   qty: 8,   d: 12 },
    { name: '土豆',   qty: 3,   d: 18 },
    { name: '大蒜',   qty: 2,   d: 40 },
    { name: '燕麦',   qty: 300, d: 50 },
    { name: '挂面',   qty: 1,   d: 150 },
    { name: '大米',   qty: 5,   d: 300 }
  ];

  /* ---------- 5. 模拟拍照识别场景 ---------- */
  const PHOTO_SCENES = [
    { label: '冰箱上层 · 生鲜区', items: [{ name: '三文鱼', qty: 200 }, { name: '柠檬', qty: 2 }, { name: '鸡翅', qty: 500 }] },
    { label: '冰箱下层 · 蔬菜抽屉', items: [{ name: '香蕉', qty: 4 }, { name: '青椒', qty: 3 }, { name: '香菇', qty: 8 }] },
    { label: '冰箱侧门 · 包装食品', items: [{ name: '酸奶', qty: 4 }, { name: '牛奶', qty: 2 }] },
    { label: '冷冻室', items: [{ name: '排骨', qty: 800 }, { name: '三文鱼', qty: 300 }] },
    { label: '剩菜盒 · 二次更新', items: [{ name: '牛里脊', qty: 120 }, { name: '西兰花', qty: 0.5 }] }
  ];

  /* ---------- 6. 菜系 ---------- */
  const CUISINES = ['家常', '川菜', '粤菜', '清淡', '西式'];
  const DISH_CUISINE = {
    'tomato-egg': ['家常'],
    'beef-broccoli': ['家常', '粤菜'],
    'milk-oats': ['西式'],
    'tomato-noodle': ['家常'],
    'spinach-tofu': ['家常', '清淡'],
    'pepper-potato': ['川菜', '家常'],
    'rib-carrot': ['粤菜', '清淡'],
    'mushroom-tofu': ['清淡'],
    'garlic-spinach': ['家常', '清淡'],
    'steamed-egg': ['清淡'],
    'apple-yogurt': ['西式'],
    'pan-salmon': ['西式', '粤菜']
  };

  /* ---------- 7. 视频对照（B 站真实视频，已核实可访问） ---------- */
  const VIDEOS = {
    'tomato-egg': [
      { bvid: 'BV1uY8vzkEmx', title: '番茄炒蛋 | 有锅就能做、黄金比例被我拿捏了' },
      { bvid: 'BV12h3F63ELa', title: '番茄炒蛋 | 酸甜开胃、国民第一下饭菜' }
    ],
    'pepper-potato': [
      { bvid: 'BV16o4y1F75W', title: '青椒土豆丝 | 零基础家常菜' }
    ],
    'steamed-egg': [
      { bvid: 'BV1Pf4y1U7RH', title: '嫩滑水蒸蛋 | 一比一点五的水蛋比例' }
    ]
  };

  // 把菜系和视频挂到菜谱上
  DISHES.forEach(function (d) {
    d.cuisine = DISH_CUISINE[d.id] || ['家常'];
    d.videos = VIDEOS[d.id] || [];
  });

  /* ---------- 8. 视频平台（搜索深链，无需任何 API Key） ---------- */
  const PLATFORMS = [
    { key: 'bilibili', name: '哔哩哔哩', icon: '📺', color: '#FB7299',
      search: k => 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(k) },
    { key: 'douyin', name: '抖音', icon: '🎵', color: '#161823',
      search: k => 'https://www.douyin.com/search/' + encodeURIComponent(k) },
    { key: 'xhs', name: '小红书', icon: '📕', color: '#FF2442',
      search: k => 'https://www.xiaohongshu.com/search_result?keyword=' + encodeURIComponent(k) }
  ];

  const PLATFORM_MAP = {};
  PLATFORMS.forEach(p => { PLATFORM_MAP[p.key] = p; });

  /* ============================================================
     9. 食材扩充包（22 → 64 种）
     ============================================================ */
  const MORE_FOODS = [
    { name: '油菜',   emoji: '🥬', cat: '蔬菜', unit: '把', shelf: 4,  price: 2.5, storage: '冷藏' },
    { name: '生菜',   emoji: '🥗', cat: '蔬菜', unit: '颗', shelf: 4,  price: 3,   storage: '冷藏' },
    { name: '卷心菜', emoji: '🥬', cat: '蔬菜', unit: '颗', shelf: 12, price: 3.5, storage: '冷藏' },
    { name: '芹菜',   emoji: '🌿', cat: '蔬菜', unit: '把', shelf: 5,  price: 2.5, storage: '冷藏' },
    { name: '韭菜',   emoji: '🌱', cat: '蔬菜', unit: '把', shelf: 3,  price: 2,   storage: '冷藏' },
    { name: '黄瓜',   emoji: '🥒', cat: '蔬菜', unit: '根', shelf: 6,  price: 1.5, storage: '冷藏' },
    { name: '冬瓜',   emoji: '🫑', cat: '蔬菜', unit: 'g',  shelf: 10, price: 0.01,storage: '冷藏' },
    { name: '南瓜',   emoji: '🎃', cat: '蔬菜', unit: 'g',  shelf: 20, price: 0.01,storage: '阴凉' },
    { name: '茄子',   emoji: '🍆', cat: '蔬菜', unit: '个', shelf: 5,  price: 2,   storage: '冷藏' },
    { name: '西葫芦', emoji: '🥒', cat: '蔬菜', unit: '个', shelf: 7,  price: 2,   storage: '冷藏' },
    { name: '豆角',   emoji: '🫘', cat: '蔬菜', unit: 'g',  shelf: 5,  price: 0.012, storage: '冷藏' },
    { name: '莲藕',   emoji: '🪷', cat: '蔬菜', unit: '节', shelf: 10, price: 4,   storage: '冷藏' },
    { name: '玉米',   emoji: '🌽', cat: '蔬菜', unit: '根', shelf: 7,  price: 2,   storage: '冷藏' },
    { name: '洋葱',   emoji: '🧅', cat: '蔬菜', unit: '个', shelf: 25, price: 1.5, storage: '阴凉' },
    { name: '生姜',   emoji: '🫚', cat: '蔬菜', unit: '块', shelf: 30, price: 1,   storage: '阴凉' },
    { name: '小米椒', emoji: '🌶️', cat: '蔬菜', unit: '个', shelf: 10, price: 0.5, storage: '冷藏' },
    { name: '山药',   emoji: '🥔', cat: '蔬菜', unit: '根', shelf: 15, price: 5,   storage: '阴凉' },
    { name: '芋头',   emoji: '🍠', cat: '蔬菜', unit: '个', shelf: 15, price: 2.5, storage: '阴凉' },
    { name: '鸡胸肉', emoji: '🍗', cat: '肉类', unit: 'g',  shelf: 3,  price: 0.09,storage: '冷藏' },
    { name: '五花肉', emoji: '🥓', cat: '肉类', unit: 'g',  shelf: 3,  price: 0.07,storage: '冷藏' },
    { name: '牛腩',   emoji: '🥩', cat: '肉类', unit: 'g',  shelf: 3,  price: 0.11,storage: '冷藏' },
    { name: '猪肉馅', emoji: '🥟', cat: '肉类', unit: 'g',  shelf: 2,  price: 0.06,storage: '冷藏' },
    { name: '鸡腿',   emoji: '🍗', cat: '肉类', unit: '个', shelf: 3,  price: 5,   storage: '冷藏' },
    { name: '虾仁',   emoji: '🦐', cat: '肉类', unit: 'g',  shelf: 2,  price: 0.16,storage: '冷冻' },
    { name: '带鱼',   emoji: '🐟', cat: '肉类', unit: 'g',  shelf: 2,  price: 0.07,storage: '冷冻' },
    { name: '培根',   emoji: '🥓', cat: '肉类', unit: '片', shelf: 20, price: 1.6, storage: '冷藏' },
    { name: '奶酪',   emoji: '🧀', cat: '蛋奶', unit: '片', shelf: 30, price: 2.5, storage: '冷藏' },
    { name: '淡奶油', emoji: '🥛', cat: '蛋奶', unit: 'ml', shelf: 7,  price: 0.03,storage: '冷藏' },
    { name: '橙子',   emoji: '🍊', cat: '水果', unit: '个', shelf: 14, price: 2.5, storage: '冷藏' },
    { name: '葡萄',   emoji: '🍇', cat: '水果', unit: '串', shelf: 6,  price: 12,  storage: '冷藏' },
    { name: '草莓',   emoji: '🍓', cat: '水果', unit: '盒', shelf: 3,  price: 18,  storage: '冷藏' },
    { name: '梨',     emoji: '🍐', cat: '水果', unit: '个', shelf: 20, price: 2.5, storage: '冷藏' },
    { name: '蓝莓',   emoji: '🫐', cat: '水果', unit: '盒', shelf: 5,  price: 15,  storage: '冷藏' },
    { name: '西瓜',   emoji: '🍉', cat: '水果', unit: '块', shelf: 3,  price: 3,   storage: '冷藏' },
    { name: '面粉',   emoji: '🌾', cat: '主食', unit: 'g',  shelf: 180,price: 0.008,storage: '常温' },
    { name: '馒头',   emoji: '🍞', cat: '主食', unit: '个', shelf: 5,  price: 1.5, storage: '冷冻' },
    { name: '面包',   emoji: '🍞', cat: '主食', unit: '片', shelf: 5,  price: 1,   storage: '常温' },
    { name: '意面',   emoji: '🍝', cat: '主食', unit: 'g',  shelf: 180,price: 0.02,storage: '常温' },
    { name: '粉丝',   emoji: '🍜', cat: '主食', unit: '把', shelf: 200,price: 3,   storage: '常温' },
    { name: '饺子皮', emoji: '🥟', cat: '主食', unit: '张', shelf: 7,  price: 0.1, storage: '冷藏' },
    { name: '豆浆',   emoji: '🥛', cat: '豆制品', unit: '杯', shelf: 2, price: 3,   storage: '冷藏' },
    { name: '腐竹',   emoji: '🫓', cat: '豆制品', unit: 'g',  shelf: 120,price: 0.05,storage: '常温' }
  ];
  MORE_FOODS.forEach(function (f) { FOOD_DB.push(f); FOOD_MAP[f.name] = f; });

  /* ---------- 10. 营养素（每 1 个单位的近似值：[kcal, 蛋白g, 钙mg, 铁mg, 维C mg]） ---------- */
  const NUT = {
    番茄: [27, 1.3, 15, 0.5, 21], 西兰花: [100, 9, 150, 2, 150], 菠菜: [46, 5.8, 132, 5.8, 64],
    土豆: [160, 4, 16, 1.6, 40], 青椒: [20, 0.8, 12, 0.6, 60], 胡萝卜: [47, 1.1, 40, 0.8, 6],
    大蒜: [60, 2.4, 15, 0.7, 3], 香菇: [4, 0.3, 2, 0.05, 0.2], 豆腐: [240, 24, 420, 3, 0],
    牛里脊: [1.1, 0.21, 0.06, 0.03, 0], 排骨: [2.8, 0.17, 0.1, 0.01, 0], 鸡翅: [2, 0.17, 0.08, 0.01, 0],
    三文鱼: [1.4, 0.2, 0.09, 0.002, 0], 鸡蛋: [72, 6.3, 25, 0.9, 0], 牛奶: [160, 8, 260, 0.1, 2],
    酸奶: [110, 5, 180, 0.1, 2], 苹果: [95, 0.5, 7, 0.2, 8], 香蕉: [105, 1.4, 7, 0.3, 10],
    柠檬: [26, 1, 58, 0.05, 48], 挂面: [350, 11, 15, 2, 0], 大米: [3450, 75, 120, 20, 0],
    燕麦: [3.8, 0.13, 0.5, 0.04, 0],
    油菜: [30, 3.6, 216, 2.4, 72], 生菜: [28, 2.6, 70, 1.8, 20], 卷心菜: [120, 7.5, 245, 3, 200],
    芹菜: [30, 2.4, 160, 1.6, 16], 韭菜: [52, 4.6, 84, 3.2, 48], 黄瓜: [22, 1.2, 36, 0.8, 13],
    冬瓜: [0.12, 0.004, 0.19, 0.002, 0.18], 南瓜: [0.26, 0.007, 0.16, 0.005, 0.08],
    茄子: [46, 2.2, 48, 0.9, 10], 西葫芦: [45, 2, 40, 0.8, 30], 豆角: [0.32, 0.02, 0.42, 0.005, 0.16],
    莲藕: [146, 3.8, 78, 2.8, 88], 玉米: [172, 8, 2, 1.2, 10], 洋葱: [60, 1.8, 36, 0.3, 12],
    生姜: [16, 0.3, 5, 0.3, 1], 小米椒: [2, 0.1, 0.4, 0.04, 7], 山药: [171, 5.7, 48, 0.9, 15],
    芋头: [158, 4.4, 72, 1, 12], 鸡胸肉: [1.33, 0.24, 0.03, 0.007, 0], 五花肉: [5.2, 0.14, 0.06, 0.01, 0],
    牛腩: [3.3, 0.18, 0.08, 0.02, 0], 猪肉馅: [3.9, 0.17, 0.06, 0.01, 0], 鸡腿: [216, 21, 10, 1, 0],
    虾仁: [0.93, 0.18, 0.6, 0.01, 0], 带鱼: [1.3, 0.18, 0.3, 0.01, 0], 培根: [60, 3.5, 1, 0.1, 0],
    奶酪: [70, 4.5, 120, 0.1, 0], 淡奶油: [3.4, 0.02, 0.7, 0, 0], 橙子: [85, 1.6, 70, 0.2, 90],
    葡萄: [200, 1.5, 30, 1.2, 12], 草莓: [80, 2.5, 45, 1, 145], 梨: [100, 0.8, 20, 0.4, 12],
    蓝莓: [70, 0.9, 10, 0.2, 12], 西瓜: [90, 1.8, 20, 0.6, 20], 面粉: [3.6, 0.1, 0.15, 0.01, 0],
    馒头: [230, 7, 20, 1.5, 0], 面包: [80, 2.5, 20, 0.5, 0], 意面: [3.5, 0.12, 0.2, 0.01, 0],
    粉丝: [340, 0.8, 30, 5, 0], 饺子皮: [28, 0.9, 3, 0.1, 0], 豆浆: [80, 7, 25, 0.5, 0],
    腐竹: [4.6, 0.45, 0.8, 0.16, 0]
  };
  FOOD_DB.forEach(function (f) {
    const n = NUT[f.name] || [40, 2, 20, 0.5, 10];
    f.nut = { kcal: n[0], p: n[1], ca: n[2], fe: n[3], vc: n[4] };
  });

  /* ---------- 11. 过敏原 ---------- */
  const ALLERGENS = ['乳', '蛋', '豆', '海鲜', '麸质', '坚果'];
  const ALLERGEN_OF = {
    牛奶: '乳', 酸奶: '乳', 奶酪: '乳', 淡奶油: '乳',
    鸡蛋: '蛋',
    豆腐: '豆', 豆浆: '豆', 腐竹: '豆',
    虾仁: '海鲜', 带鱼: '海鲜', 三文鱼: '海鲜',
    面粉: '麸质', 面包: '麸质', 挂面: '麸质', 意面: '麸质', 饺子皮: '麸质', 馒头: '麸质'
  };
  FOOD_DB.forEach(function (f) { f.allergen = ALLERGEN_OF[f.name] || ''; });

  /* ---------- 12. 食材替换表 ---------- */
  const SUBSTITUTES = {
    牛里脊: ['鸡胸肉', '五花肉'], 鸡胸肉: ['牛里脊'], 排骨: ['牛腩', '鸡腿'],
    五花肉: ['猪肉馅'], 牛腩: ['排骨'], 三文鱼: ['带鱼'], 带鱼: ['三文鱼'],
    菠菜: ['油菜', '生菜'], 油菜: ['菠菜', '生菜'], 生菜: ['油菜'], 西兰花: ['油菜', '卷心菜'],
    卷心菜: ['生菜'], 牛奶: ['豆浆', '酸奶'], 豆浆: ['牛奶'], 豆腐: ['腐竹'], 腐竹: ['豆腐'],
    青椒: ['小米椒'], 小米椒: ['青椒'], 意面: ['挂面'], 挂面: ['意面'], 面包: ['馒头'], 馒头: ['面包'],
    淡奶油: ['牛奶'], 香菇: ['口蘑'], 土豆: ['山药'], 山药: ['土豆']
  };

  /* ============================================================
     13. 菜谱扩充包（12 → 30 道）
     ============================================================ */
  Object.assign(DISH_CUISINE, {
    'garlic-chicken': ['西式', '家常'], 'onion-egg': ['家常'], 'tomato-beef': ['家常', '川菜'],
    'wintermelon-rib': ['粤菜', '清淡'], 'stir-youcai': ['家常', '清淡'], 'cucumber-salad': ['家常', '清淡'],
    'lotus-rib': ['粤菜'], 'corn-carrot-soup': ['清淡', '粤菜'], 'chive-egg': ['家常'],
    'eggplant-beans': ['家常', '川菜'], 'shrimp-egg': ['粤菜'], 'pan-hairtail': ['家常'],
    'pumpkin-soup': ['西式'], 'bolognese': ['西式'], 'bacon-sandwich': ['西式'],
    'hand-cabbage': ['川菜', '家常'], 'yam-rib': ['粤菜', '清淡'], 'noodle-bolognese': ['家常']
  });

  const MORE_DISHES = [
    {
      id: 'garlic-chicken', name: '蒜香鸡胸', emoji: '🍗', minutes: 18, level: '新手',
      meals: ['午', '晚'], tags: ['高蛋白', '低脂', '健身'],
      ingredients: [{ name: '鸡胸肉', qty: 300 }],
      seasonings: ['盐 2 g', '黑胡椒 少许', '蒜末 3 瓣', '橄榄油 10 ml', '柠檬汁 5 ml'],
      prep: ['鸡胸片成 1.5 cm 厚片，用刀背轻拍松。', '加盐、黑胡椒、蒜末、柠檬汁腌 10 分钟。'],
      steps: [
        { heat: '中火', text: '平底锅烧热倒油，鸡胸下锅煎 3 分钟，别翻动。' },
        { heat: '中火', text: '翻面再煎 2 分钟，两面金黄即可。' },
        { heat: '关火', text: '出锅静置 2 分钟再切，肉汁不流失。' }
      ],
      tips: ['拍松能让厚薄一致，不会外焦里生。', '静置再切是嫩的关键。'],
      nutrition: '每 100 g 约 24 g 蛋白质、脂肪低，健身餐首选。', pair: '优质蛋白 → 增肌减脂'
    },
    {
      id: 'onion-egg', name: '洋葱炒蛋', emoji: '🧅', minutes: 12, level: '新手',
      meals: ['早', '午', '晚'], tags: ['快手', '家常'],
      ingredients: [{ name: '洋葱', qty: 1 }, { name: '鸡蛋', qty: 3 }],
      seasonings: ['盐 2 g', '生抽 5 ml', '食用油 15 ml'],
      prep: ['洋葱切丝，鸡蛋打散。'],
      steps: [
        { heat: '大火', text: '鸡蛋炒散盛出，别炒老。' },
        { heat: '大火', text: '下洋葱丝炒 2 分钟到透明、边缘微焦。' },
        { heat: '大火', text: '倒回鸡蛋，加盐和生抽，翻 15 秒出锅。' }
      ],
      tips: ['洋葱炒到微焦才甜。', '鸡蛋先盛出，回锅才嫩。'],
      nutrition: '洋葱含硫化物，鸡蛋补蛋白，简单但很下饭。', pair: '硫化物 + 优质蛋白'
    },
    {
      id: 'tomato-beef', name: '番茄牛腩', emoji: '🍲', minutes: 90, level: '进阶',
      meals: ['午', '晚'], tags: ['煲', '补铁', '周末'],
      ingredients: [{ name: '牛腩', qty: 500 }, { name: '番茄', qty: 2 }],
      seasonings: ['番茄酱 20 g', '姜 3 片', '料酒 10 ml', '盐 3 g', '冰糖 5 g'],
      prep: ['牛腩冷水下锅焯水，撇沫后冲净切块。', '番茄一半切块一半切碎。'],
      steps: [
        { heat: '大火', text: '下油炒香姜片，放牛腩煸 3 分钟。' },
        { heat: '中小火', text: '加番茄碎和番茄酱炒出红油，加水没过，炖 60 分钟。' },
        { heat: '中小火', text: '下番茄块再炖 15 分钟，加盐和冰糖收汁。' }
      ],
      tips: ['番茄分两次下，一次出味一次留形。', '炖的过程保持小泡，别大滚。'],
      nutrition: '牛肉铁 + 番茄维 C，补铁效率高，适合经期和老人。', pair: '铁 + 维C → 补铁加倍'
    },
    {
      id: 'wintermelon-rib', name: '冬瓜排骨汤', emoji: '🍲', minutes: 55, level: '新手',
      meals: ['午', '晚'], tags: ['清淡', '消肿', '少油'],
      ingredients: [{ name: '冬瓜', qty: 400 }, { name: '排骨', qty: 300 }],
      seasonings: ['姜 3 片', '盐 3 g', '料酒 10 ml', '白胡椒 少许'],
      prep: ['排骨冷水下锅焯水。', '冬瓜去皮切厚片。'],
      steps: [
        { heat: '大火', text: '排骨加姜片和 1.2 L 水，烧开转小火炖 35 分钟。' },
        { heat: '中火', text: '下冬瓜煮 12 分钟到透明。' },
        { heat: '关火', text: '加盐和白胡椒，撒葱花。' }
      ],
      tips: ['冬瓜后放，久煮会化。', '这道汤几乎不用油。'],
      nutrition: '冬瓜含水量高、热量低，配排骨汤清爽又补水。', pair: '低热量 + 优质蛋白'
    },
    {
      id: 'stir-youcai', name: '清炒油菜', emoji: '🥬', minutes: 8, level: '新手',
      meals: ['午', '晚'], tags: ['3 分钟上桌', '补钙'],
      ingredients: [{ name: '油菜', qty: 1 }],
      seasonings: ['蒜末 2 瓣', '盐 2 g', '食用油 8 ml'],
      prep: ['油菜洗净对半切。'],
      steps: [
        { heat: '中火', text: '蒜末小火爆香。' },
        { heat: '大火', text: '下油菜大火快炒 60 秒，加盐翻匀。' },
        { heat: '关火', text: '立刻出锅，保持翠绿。' }
      ],
      tips: ['大火快炒是保色的关键。', '油菜钙含量不低，别煮太久。'],
      nutrition: '油菜钙含量在绿叶菜里偏高，比牛奶更好吸收的搭配是少油快炒。', pair: '钙 + 维K → 骨骼友好'
    },
    {
      id: 'cucumber-salad', name: '凉拌黄瓜', emoji: '🥒', minutes: 6, level: '新手',
      meals: ['午', '晚'], tags: ['凉菜', '解腻', '零火'],
      ingredients: [{ name: '黄瓜', qty: 2 }],
      seasonings: ['蒜末 2 瓣', '生抽 10 ml', '香醋 8 ml', '香油 3 ml', '小米椒 1 个'],
      prep: ['黄瓜拍裂切段，撒 2 g 盐腌 5 分钟挤掉水。'],
      steps: [
        { heat: '无火', text: '蒜末、生抽、香醋、香油、小米椒调成料汁。' },
        { heat: '无火', text: '浇在黄瓜上拌匀，冰 5 分钟更爽。' }
      ],
      tips: ['拍裂比切片更入味。', '腌出水再拌，不会稀。'],
      nutrition: '几乎零热量，聚餐解腻必备。', pair: '水分 + 钾 → 解腻消肿'
    },
    {
      id: 'lotus-rib', name: '莲藕排骨汤', emoji: '🍲', minutes: 60, level: '新手',
      meals: ['午', '晚'], tags: ['煲汤', '润燥', '粤式'],
      ingredients: [{ name: '莲藕', qty: 1 }, { name: '排骨', qty: 300 }],
      seasonings: ['姜 3 片', '盐 3 g', '料酒 10 ml'],
      prep: ['排骨焯水冲净。', '莲藕去皮切滚刀块。'],
      steps: [
        { heat: '大火', text: '全部材料下锅，加水烧开。' },
        { heat: '小火', text: '转小火炖 45 分钟。' },
        { heat: '关火', text: '加盐调味即可。' }
      ],
      tips: ['选粉藕（七孔）更糯。', '盐最后放。'],
      nutrition: '莲藕含膳食纤维和维 C，配排骨汤温润。', pair: '膳食纤维 + 钙'
    },
    {
      id: 'corn-carrot-soup', name: '玉米胡萝卜汤', emoji: '🌽', minutes: 40, level: '新手',
      meals: ['午', '晚'], tags: ['清甜', '孩子爱吃'],
      ingredients: [{ name: '玉米', qty: 1 }, { name: '胡萝卜', qty: 1 }],
      seasonings: ['盐 2 g', '姜 2 片'],
      prep: ['玉米切段，胡萝卜切块。'],
      steps: [
        { heat: '大火', text: '加水 1 L 烧开，下所有材料。' },
        { heat: '小火', text: '转小火煮 25 分钟。' },
        { heat: '关火', text: '加盐调味。' }
      ],
      tips: ['玉米须留着一起煮，更清甜。', '不用放糖。'],
      nutrition: '玉米和胡萝卜的天然甜味，孩子不抗拒，几乎不用调味。', pair: '胡萝卜素 + 膳食纤维'
    },
    {
      id: 'chive-egg', name: '韭菜炒蛋', emoji: '🌱', minutes: 10, level: '新手',
      meals: ['早', '午', '晚'], tags: ['快手', '家常'],
      ingredients: [{ name: '韭菜', qty: 1 }, { name: '鸡蛋', qty: 3 }],
      seasonings: ['盐 2 g', '食用油 15 ml'],
      prep: ['韭菜切 3 cm 段。', '鸡蛋打散加一小撮盐。'],
      steps: [
        { heat: '大火', text: '蛋液炒成块盛出。' },
        { heat: '大火', text: '下韭菜快炒 40 秒。' },
        { heat: '大火', text: '倒回鸡蛋，加盐翻匀出锅。' }
      ],
      tips: ['韭菜下锅别超过 1 分钟。', '鸡蛋先炒后回锅。'],
      nutrition: '韭菜纤维多、鸡蛋补蛋白，早餐很合适。', pair: '膳食纤维 + 蛋白'
    },
    {
      id: 'eggplant-beans', name: '茄子豆角', emoji: '🍆', minutes: 20, level: '新手',
      meals: ['午', '晚'], tags: ['下饭', '家常'],
      ingredients: [{ name: '茄子', qty: 2 }, { name: '豆角', qty: 300 }],
      seasonings: ['蒜末 3 瓣', '生抽 10 ml', '蚝油 8 g', '盐 2 g', '油 20 ml'],
      prep: ['茄子切条撒盐腌 10 分钟挤水（省油）。', '豆角掰段。'],
      steps: [
        { heat: '大火', text: '豆角干煸 3 分钟到起皱盛出。' },
        { heat: '大火', text: '下茄子炒软，加蒜末、生抽、蚝油。' },
        { heat: '大火', text: '倒回豆角翻 1 分钟，加盐出锅。' }
      ],
      tips: ['茄子先腌出水，能省一半油。', '豆角一定炒熟，生的有毒。'],
      nutrition: '茄子皮含花青素，别削太干净；豆角要彻底加热。', pair: '花青素 + 植物蛋白'
    },
    {
      id: 'shrimp-egg', name: '虾仁滑蛋', emoji: '🦐', minutes: 12, level: '新手',
      meals: ['午', '晚'], tags: ['高蛋白', '孩子爱吃', '粤式'],
      ingredients: [{ name: '虾仁', qty: 200 }, { name: '鸡蛋', qty: 3 }],
      seasonings: ['盐 2 g', '料酒 5 ml', '淀粉 3 g', '油 15 ml'],
      prep: ['虾仁加料酒、盐、淀粉抓匀腌 5 分钟。', '鸡蛋打散加 2 勺水。'],
      steps: [
        { heat: '中火', text: '虾仁滑炒 40 秒变色盛出。' },
        { heat: '中小火', text: '倒蛋液，用铲子慢慢推，半凝固时放回虾仁。' },
        { heat: '关火', text: '还带点湿润就盛出，余温会继续熟。' }
      ],
      tips: ['全程中小火，蛋才滑。', '虾仁过熟会硬。'],
      nutrition: '虾仁高蛋白低脂，鸡蛋嫩滑好消化，幼儿也能吃。', pair: '优质蛋白 ×2'
    },
    {
      id: 'pan-hairtail', name: '香煎带鱼', emoji: '🐟', minutes: 20, level: '进阶',
      meals: ['午', '晚'], tags: ['下饭', '补钙'],
      ingredients: [{ name: '带鱼', qty: 400 }],
      seasonings: ['盐 3 g', '料酒 10 ml', '面粉 20 g', '姜 3 片', '油 20 ml'],
      prep: ['带鱼洗净剪段，加盐、料酒、姜腌 10 分钟。', '擦干后薄薄拍一层面粉。'],
      steps: [
        { heat: '中火', text: '油热后下带鱼，别急着翻。' },
        { heat: '中火', text: '一面煎 3 分钟定型再翻面，再煎 2 分钟。' },
        { heat: '关火', text: '出锅撒椒盐。' }
      ],
      tips: ['拍面粉防粘、更脆。', '定型前别翻，会碎。'],
      nutrition: '带鱼含钙和不饱和脂肪酸，煎着吃比油炸健康。', pair: '钙 + 不饱和脂肪'
    },
    {
      id: 'pumpkin-soup', name: '南瓜浓汤', emoji: '🎃', minutes: 25, level: '新手',
      meals: ['早', '午'], tags: ['西式', '孩子爱吃', '暖'],
      ingredients: [{ name: '南瓜', qty: 300 }, { name: '牛奶', qty: 1 }],
      seasonings: ['盐 1 g', '黑胡椒 少许', '黄油 5 g'],
      prep: ['南瓜去皮切块蒸 12 分钟。'],
      steps: [
        { heat: '中小火', text: '黄油化开，下南瓜压成泥炒 1 分钟。' },
        { heat: '中小火', text: '分次倒入牛奶搅匀，煮 3 分钟。' },
        { heat: '关火', text: '加盐和黑胡椒，搅拌机打细更顺滑。' }
      ],
      tips: ['牛奶分次加，不容易结块。', '打一遍再回锅，口感差很多。'],
      nutrition: '南瓜胡萝卜素 + 牛奶钙，早餐喝一碗很顶。', pair: '胡萝卜素 + 钙'
    },
    {
      id: 'bolognese', name: '意面番茄肉酱', emoji: '🍝', minutes: 30, level: '进阶',
      meals: ['午', '晚'], tags: ['西式', '孩子爱吃', '一锅出'],
      ingredients: [{ name: '意面', qty: 200 }, { name: '猪肉馅', qty: 200 }, { name: '番茄', qty: 2 }],
      seasonings: ['洋葱 半个', '番茄酱 30 g', '盐 3 g', '黑胡椒 少许', '橄榄油 15 ml'],
      prep: ['番茄切碎，洋葱切末。'],
      steps: [
        { heat: '大火', text: '意面煮 8 分钟（按包装），留一碗面汤。' },
        { heat: '中火', text: '炒香洋葱，下肉馅炒散，加番茄碎和番茄酱熬 10 分钟。' },
        { heat: '中火', text: '拌入意面，加两勺面汤收汁，撒黑胡椒。' }
      ],
      tips: ['面汤有淀粉，是让酱挂住面的关键。', '肉馅先炒干再放番茄。'],
      nutrition: '碳水 + 蛋白 + 番茄红素，孩子最容易接受的一餐。', pair: '番茄红素 + 蛋白'
    },
    {
      id: 'bacon-sandwich', name: '培根鸡蛋三明治', emoji: '🥪', minutes: 10, level: '新手',
      meals: ['早'], tags: ['早餐', '快手', '西式'],
      ingredients: [{ name: '面包', qty: 4 }, { name: '培根', qty: 4 }, { name: '鸡蛋', qty: 2 }],
      seasonings: ['生菜 2 片', '奶酪 1 片', '黑胡椒 少许'],
      prep: ['面包烤 1 分钟到微脆。'],
      steps: [
        { heat: '中火', text: '培根煎 2 分钟到出油变脆。' },
        { heat: '中火', text: '用培根的油煎一个溏心蛋。' },
        { heat: '无火', text: '面包 + 生菜 + 培根 + 蛋 + 奶酪叠起来，对角切。' }
      ],
      tips: ['培根自己出油，不用另加油。', '生菜垫在最下层，面包不湿。'],
      nutrition: '一份约 450 kcal，蛋白质够，适合赶时间的早上。', pair: '蛋白 + 碳水 → 顶饱'
    },
    {
      id: 'hand-cabbage', name: '手撕包菜', emoji: '🥬', minutes: 12, level: '新手',
      meals: ['午', '晚'], tags: ['下饭', '川味', '快手'],
      ingredients: [{ name: '卷心菜', qty: 1 }, { name: '小米椒', qty: 2 }],
      seasonings: ['蒜末 3 瓣', '生抽 10 ml', '香醋 8 ml', '盐 2 g', '油 20 ml'],
      prep: ['包菜手撕成大片（别用刀切）。'],
      steps: [
        { heat: '大火', text: '油烧到冒烟，下蒜末和小米椒爆香。' },
        { heat: '大火', text: '下包菜大火爆炒 90 秒，边缘微焦。' },
        { heat: '大火', text: '沿锅边淋醋和生抽，加盐翻匀出锅。' }
      ],
      tips: ['手撕的断面更挂味。', '锅要够热，才有锅气。'],
      nutrition: '包菜维 C 含量高，大火快炒流失少。', pair: '维C + 膳食纤维'
    },
    {
      id: 'yam-rib', name: '山药排骨汤', emoji: '🍲', minutes: 60, level: '新手',
      meals: ['午', '晚'], tags: ['煲汤', '养胃', '老人友好'],
      ingredients: [{ name: '山药', qty: 1 }, { name: '排骨', qty: 300 }],
      seasonings: ['姜 3 片', '盐 3 g', '枸杞 一小把'],
      prep: ['排骨焯水。', '山药去皮切段（戴手套防痒）。'],
      steps: [
        { heat: '大火', text: '排骨加水烧开，转小火 30 分钟。' },
        { heat: '小火', text: '下山药再煮 15 分钟。' },
        { heat: '关火', text: '加盐、撒枸杞焖 3 分钟。' }
      ],
      tips: ['山药黏液会让手痒，一定戴手套。', '山药别久煮，会散。'],
      nutrition: '山药好消化、养胃，老人和幼儿都适合。', pair: '黏液蛋白 + 钙'
    },
    {
      id: 'noodle-bolognese', name: '番茄肉酱拌面', emoji: '🍜', minutes: 18, level: '新手',
      meals: ['午', '晚'], tags: ['一锅出', '快手'],
      ingredients: [{ name: '挂面', qty: 1 }, { name: '猪肉馅', qty: 150 }, { name: '番茄', qty: 2 }],
      seasonings: ['生抽 10 ml', '番茄酱 15 g', '盐 2 g', '蒜末 2 瓣'],
      prep: ['番茄切小丁。'],
      steps: [
        { heat: '中火', text: '炒香蒜末，下肉馅炒散出油。' },
        { heat: '中火', text: '下番茄丁炒出汁，加番茄酱和生抽，煮 5 分钟。' },
        { heat: '大火', text: '面条另锅煮 3 分钟，捞出拌酱。' }
      ],
      tips: ['面煮好直接拌，别过冷水。', '酱要稠一点才挂面。'],
      nutrition: '一碗搞定碳水、蛋白和蔬菜，上班族晚餐首选。', pair: '番茄红素 + 肉蛋白'
    }
  ];
  MORE_DISHES.forEach(function (d) {
    d.cuisine = DISH_CUISINE[d.id] || ['家常'];
    d.videos = VIDEOS[d.id] || [];
    DISHES.push(d);
  });

  w.DD_DATA = {
    FOOD_DB, FOOD_MAP, DISHES, PAIRS, SEED, PHOTO_SCENES,
    CUISINES, VIDEOS, PLATFORMS, PLATFORM_MAP,
    ALLERGENS, SUBSTITUTES, NUT
  };
})(window);
