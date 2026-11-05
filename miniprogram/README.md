# 冰箱对对碰 · 微信小程序版

与 web 版**共用同一套核心**（食材库、菜谱库、四色保质期、营养配餐算法），只用 WXML / WXSS 重写了视图层。

## 一、怎么跑起来

1. 打开 **微信开发者工具** → 导入项目
2. 目录选 `fridge-pair/miniprogram`
3. AppID 选「测试号」即可（`project.config.json` 里默认是 `touristappid`）
4. 点编译，模拟器里就能看到

> 不需要 npm、不需要构建。`lib/` 里的三个文件是自动生成的副本，不要手改。

## 二、目录结构

```
miniprogram/
├── app.js              入口：加载 shim + 核心，首次进入自动建演示家庭
├── app.json            页面注册 + 4 个 tabBar
├── app.wxss            全局设计语言（与 web 版同一套绿）
├── project.config.json
├── sitemap.json
├── lib/
│   ├── shim.js         ★ 关键：提供 window / localStorage，让 web 版核心原样运行
│   ├── data.js         ← 自动复制自 js/data.js
│   ├── engine.js       ← 自动复制自 js/engine.js
│   └── store.js        ← 自动复制自 js/store.js
└── pages/
    ├── fridge/         冰箱：四色总览 + 分类筛选 + 吃掉/丢弃 + 拍照入库
    ├── recipe/         菜谱：能做的 / 全部 + 搜索
    ├── dish/           菜谱详情：食材用量 + 预处理 + 分步做法 + 开始做菜
    ├── plan/           一周配餐：生成 7 天菜单
    └── me/             我的：家庭档案、健康度、时间旅行、重置
```

## 三、核心复用的原理

web 版的核心文件是 IIFE，挂在 `window` 上，并用 `localStorage` 持久化。小程序里两者都不存在，所以加了一层垫片：

```js
// lib/shim.js
globalThis.window = globalThis;          // 让 (function(w){...})(window) 正常工作
globalThis.localStorage = {              // 用 wx 的同步存储实现
  getItem: k => wx.getStorageSync(k) || null,
  setItem: (k, v) => wx.setStorageSync(k, String(v)),
  removeItem: k => wx.removeStorageSync(k)
};
```

于是 `require('./lib/data.js')` 之后，`globalThis.DD_DATA / DD_ENGINE / DD_STORE` 就都在了，页面里直接取用：

```js
const D = globalThis.DD_DATA, E = globalThis.DD_ENGINE, S = globalThis.DD_STORE;
```

## 四、更新核心代码

web 版改完 `js/data.js`、`js/engine.js`、`js/store.js` 后，执行：

```
node tools/build-mp.mjs
```

会把三个文件重新复制到 `miniprogram/lib/`，两端逻辑保持一致。

冒烟测试（用假的 wx 环境跑一遍核心）：

```
node tools/test-mp.mjs
```

期望输出：18 件食材、68 道菜、四色 8/5/4/1、7 天菜单、13 道可做、做菜后食材数 18→17。

## 五、已实现 / 未实现

**已实现**

| 能力 | 说明 |
|---|---|
| 四色保质期 | 打开即按剩余天数上色，临期一键筛选 |
| 分类筛选 | 全部 / 临期 / 过期 / 按食材分类 |
| 吃掉 · 丢弃 | 长按食材弹出操作，库存实时更新 |
| 拍照入库 | `wx.chooseMedia` 调相机/相册，演示版用预设场景模拟识别 |
| 菜谱 | 能做的 / 全部 + 搜索 + 详情（用量、预处理、分步做法） |
| 做菜扣库存 | 点「开始做菜」按菜谱用量扣减并持久化 |
| 一周配餐 | 按家庭档案生成 7 天早/午/晚菜单 |
| 我的 | 家庭档案、冰箱健康度、时间旅行、重置演示数据 |

**未实现（web 版有，小程序需单独适配）**

| 能力 | 原因 / 后续做法 |
|---|---|
| 开屏动画 / 开机爆炸 | 需要 DOM + CSS 动画，小程序要用 WXS 动画或 canvas 重做 |
| AI 对话助手 | 文本框 + 指令解析可复用 `parseCommand`，但需要重写对话 UI |
| 视频教程 | iframe 不可用，需 `<web-view>` + 业务域名备案，或改用「跳转 B 站」 |
| 附近超市 | 需要 `wx.getLocation` + 地图组件，且要申请位置权限 |
| 拖拽 AI 图标 | 小程序没有自由定位的浮层，需用 movable-area |
| 真实菜品照片 | 本地 `img/` 体积大，建议放 CDN 或改用云存储 fileID |

## 六、注意事项

- **体积**：核心三个文件约 123 KB，远低于小程序 2 MB 主包上限
- **存储**：小程序单 key 上限 1 MB，`localStorage` 垫片直接映射到 `wx.setStorageSync`，目前状态约几十 KB，安全
- **菜品照片**：小程序不能直接引 `../img/*.jpg`（不在包内时），如需图片建议上传到云开发存储后返回 URL
- **审核**：涉及拍照与位置权限，提审时需在 `app.json` 里声明 `permission` 与用途说明
