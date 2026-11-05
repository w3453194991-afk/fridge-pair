# 食材识别中转服务

小程序里**不能**直接调百度 AI：Client Secret 一旦放进前端就会被抓包。
所以中间加一层服务，只由它持有密钥。

```
小程序 ──(base64 图片)──▶ 本服务 ──(密钥)──▶ 百度 AI
        ◀──(食材列表)────          ◀──────
```

## 一、跑起来（零依赖）

```powershell
cd E:\deepseek\fridge-pair\server
node index.js
```

看到这样就是成功：

```
 ========================================
  冰箱对对碰 · 识别中转服务已启动
  地址:  http://127.0.0.1:8787
  模式:  MOCK（未配置百度密钥）
 ========================================
```

**没配密钥时是 mock 模式**，返回模拟识别结果，演示照样能跑。

## 二、接真实识别（百度 AI）

### 1. 申请

1. 打开 <https://console.bce.baidu.com/ai/> → 登录
2. 左侧「图像识别」→ 创建应用（名称随便，接口选「图像识别」）
3. 拿到 **API Key** 和 **Secret Key**

### 2. 配置并启动

```powershell
cd E:\deepseek\fridge-pair\server
$env:BAIDU_API_KEY="你的API Key"
$env:BAIDU_API_SECRET="你的Secret"
node index.js
```

启动日志会变成 `模式: 百度 AI 真实识别`。

### 3. 验证

```powershell
curl http://127.0.0.1:8787/health
# {"ok":true,"mode":"baidu",...}
```

## 三、接口

### GET /health

```json
{ "ok": true, "mode": "mock | baidu", "uptime": 12 }
```

### POST /recognize

请求：

```json
{ "image": "<base64，可带 data:image/jpeg;base64, 前缀>" }
```

响应：

```json
{
  "ok": true,
  "source": "baidu | mock",
  "items": [
    { "name": "番茄", "score": 0.96, "raw": "西红柿" }
  ]
}
```

- 先调百度**果蔬识别**（`ingredient`），
- 识别不到再退回**菜品识别**（`dish`），
- 名字会按 `ALIAS` 表归一到本项目的食材库（西红柿→番茄、马铃薯→土豆…）。
- 出错时也返回 `items`（mock 结果），避免演示中断。

## 四、小程序侧配置

`miniprogram/config.js`：

```js
module.exports = {
  API_BASE: 'http://127.0.0.1:8787',
  USE_REMOTE: true,
  TIMEOUT: 15000
};
```

- **开发者工具**：勾选「详情 → 本地设置 → 不校验合法域名」即可直连 `127.0.0.1`
- **真机预览 / 上线**：必须是 **https 且已在小程序后台「开发管理 → 服务器域名」配置**的地址，
  本地 IP 在真机上连不上（手机与电脑不同网段或微信拦截）

连不上服务时，小程序会自动回退到本地演示识别，并在结果页标注「服务未连接，已回退演示」。

## 五、上线怎么部署

任意能跑 Node 的地方都行（一台 1 核 1G 的云服务器足够）：

```bash
# 用 pm2 常驻
pm2 start index.js --name fridge-relay
```

再用 Nginx 反代到 443 并配证书，然后把 `https://api.你的域名.com` 填进
小程序后台的 request 合法域名，同时改 `miniprogram/config.js` 的 `API_BASE`。

## 六、安全

- 密钥只存在服务端环境变量里，**不进代码仓库**
- 建议再加：请求频率限制、图片大小上限（当前 12MB）、简单的调用来源鉴权
