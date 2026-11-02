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

  w.DD_DATA = { FOOD_DB, FOOD_MAP, DISHES, PAIRS, SEED, PHOTO_SCENES, CUISINES, VIDEOS, PLATFORMS, PLATFORM_MAP };
})(window);
