# 食材识别 —— 部署与配置

小程序自己**没有**食物识别能力，必须调外部 AI。这里给两条路，按是否需要真机选：

| 方案 | 真机可用 | 需要域名/备案 | 费用 |
|---|---|---|---|
| **A. 微信云开发云函数** | ✅ | ❌ 不需要 | 有免费额度 |
| B. 公网 HTTP 中转服务 | ✅ 但域名须**已备案** | ✅ 需要 | 免费平台多为境外域名，真机被拦 |

> 关键限制：小程序的 `wx.request` 只认**已备案的 HTTPS 域名**。
> Vercel / Render / Cloudflare 送的 `*.vercel.app`、`*.workers.dev` 都是境外域名，
> 在开发者工具里关掉「校验合法域名」能用，**真机上会被拦截**。
> 所以真机演示请走方案 A。

---

## A. 云开发云函数（推荐）

### 1. 开通云开发

开发者工具左上角 **「云开发」** → 开通 → 选**基础版/免费额度** → 创建环境（名字随便）。

创建完记下**环境 ID**，形如 `fridge-1a2b3c4d`。

### 2. 填环境 ID

`miniprogram/config.js`：

```js
module.exports = {
  CLOUD_ENV: 'fridge-1a2b3c4d',   // ← 换成你的环境 ID
  API_BASE: '',
  USE_CLOUD: true,
  USE_REMOTE: false
};
```

### 3. 上传云函数

资源管理器里右键 **`cloudfunctions/recognize`** → **「上传并部署：云端安装依赖」**。

（`project.config.json` 里已经配好 `cloudfunctionRoot: "cloudfunctions/"`）

### 4. 配百度密钥

1. <https://console.bce.baidu.com/ai/> → 登录 → 「图像识别」→ 创建应用
2. 拿到 **API Key** / **Secret Key**
3. 云开发控制台 → **云函数** → `recognize` → **配置** → **环境变量**：

```
BAIDU_API_KEY    = 你的 API Key
BAIDU_API_SECRET = 你的 Secret Key
```

4. 保存后**重新上传一次云函数**（让环境变量生效）

### 5. 验证

拍一张食材照，识别结果页顶部会显示：

- `百度 AI 识别（云函数）` → 真识别成功
- `云函数演示识别` → 云函数通了但没配密钥
- `服务未连接，已回退演示` → 云函数或环境 ID 有问题

---

## A2. 内容安全（上架必备）

涉及「共享视频库」「自定义菜名公开」的内容，都需要过微信内容安全接口。

### 部署

两个云函数都要部署：

```
cloudfunctions/security    ← 文本 + 媒体检测
cloudfunctions/videos      ← 视频库（发布时带 traceId）
```

数据库新建集合：

```
videos         权限：所有用户可读，仅创建者可读写
media_checks   权限：仅创建者可读写
```

### 配置消息推送（媒体异步检测必须）

`mediaCheckAsync` 是异步的，结果要通过「消息推送」回推。

```
微信公众平台 → 开发 → 开发管理 → 开发设置 → 消息推送
  数据格式：JSON
  URL：留空（勾选「云开发」）
  云函数：security
  消息加密方式：明文
  订阅事件：只勾「内容安全」
```

回调进 `security` 云函数，判断 `event.Event === 'wxa_media_check'`，
不通过会把 `videos` 里对应记录置为 `blocked`，不再展示。

### 检测流程

```
用户上传视频
   ↓
① 文本检测 msgSecCheck（菜名 + 标题）
   ├─ 不通过 → 直接拒绝发布
   └─ 通过
        ↓
② 媒体检测 mediaCheckAsync → 拿 traceId
        ↓
③ videos.publish 写入，并记录 checkTrace
        ↓
④ 回调到达
   ├─ pass    → 保持上架
   └─ 不通过  → status = blocked（列表里消失）
```

### 注意

- `msgSecCheck` 需要传 `openid`，云函数里用 `cloud.getWXContext().OPENID`
- 腾讯侧偶发超时会走到降级分支（允许发布但标"审核中"），这是刻意保留的
- 免费额度充足，正常使用不产生额外费用

---

## B. 公网 HTTP 中转服务（本机调试 / 有备案域名时）

目录：`server/`

```powershell
cd server
$env:BAIDU_API_KEY="你的Key"
$env:BAIDU_API_SECRET="你的Secret"
node index.js
```

默认端口 8787，接口：

```
GET  /health      → { ok, mode: 'mock' | 'baidu' }
POST /recognize   → { image: '<base64>' } → { items: [{name, score}] }
```

`miniprogram/config.js` 改成：

```js
CLOUD_ENV: '',
API_BASE: 'http://127.0.0.1:8787',   // 开发者工具里用（需关域名校验）
USE_CLOUD: false,
USE_REMOTE: true
```

### 部署到公网

任意能跑 Node 的地方（示例 Render，免费）：

1. 把 `server/` 推到 GitHub
2. Render → New → Web Service → 选仓库
3. Build Command 留空，Start Command 填 `node index.js`
4. 环境变量加 `BAIDU_API_KEY` / `BAIDU_API_SECRET`
5. 拿到 `https://xxx.onrender.com`，填进 `API_BASE`

> 注意：`onrender.com` 未备案，**真机用不了**，只能在开发者工具里演示。
> 要真机用，需自备已备案域名 + Nginx 反代 + HTTPS 证书。

---

## 降级逻辑

拍照页按顺序尝试，全部失败才用本地场景库：

```
云函数（若配了 CLOUD_ENV）
  → HTTP 中转（若配了 API_BASE）
    → 本地演示识别
```

并在结果页顶部标明当前来源，不会让你误以为在真识别。
