# 冰箱对对碰 · 微信小程序版

与 web 版共用同一套核心（食材库、菜谱库、四色保质期、营养配餐算法），只用 WXML / WXSS 重写了视图层。

## 一、怎么跑

1. 微信开发者工具 → 导入项目
2. 目录选 `fridge-pair/miniprogram`（**不是**仓库根目录）
3. AppID 选「测试号」
4. 点编译

不需要 npm、不需要构建。

## 二、核心复用原理（v2，不依赖全局变量）

小程序没有 `window` 和 `localStorage`，所以：

- `lib/shim.js` 导出一个共享对象，里面用 wx 同步存储实现了 `localStorage`
- `tools/build-mp.mjs` 在三个核心文件**顶部注入局部变量**：

```js
const window = require('./shim.js');
const localStorage = window.localStorage;
```

- 页面里这样取用（不再用 globalThis）：

```js
const G = require('../../lib/shim.js');
const D = G.DD_DATA, E = G.DD_ENGINE, S = G.DD_STORE;
```

这样 `data/engine/store` 三个文件可以**原样复用**，两端逻辑永远一致。

## 三、更新核心 / 自测

```
node tools/build-mp.mjs     # web 版改完 js/data|engine|store 后同步
node tools/test-mp.cjs      # 用真实 CommonJS 加载跑一遍核心
```

期望：18 件食材 / 68 道菜 / 四色 8-5-4-1 / 7 天菜单 / 13 道可做 / 做菜 18→17。

## 四、页面

| 页面 | 能力 |
|---|---|
| fridge | 四色总览、分类筛选、吃掉/丢弃、拍照入库 |
| recipe | 能做的 / 全部 + 搜索 |
| dish | 用量、预处理、分步做法、开始做菜扣库存 |
| plan | 生成 7 天菜单 |
| me | 家庭档案、健康度、时间旅行、重置 |

## 五、未移植

开屏/开机动画（需 DOM 动画）、AI 对话（UI 需重写，解析逻辑可复用）、视频（需 web-view + 域名备案）、附近超市（需定位 + map 组件）、拖拽助手图标（需 movable-area）。

## 六、排错

- 页面空白：先看开发者工具 Console 的红字；首页已内置错误提示卡，会直接显示原因
- 确认导入的是 `miniprogram/` 目录
- 首次进入会自动建一个演示家庭，若没数据点「我的 → 重置」