# 智能门禁

部署在 Cloudflare Workers 的门禁控制与用户管理系统。支持：

- 用户名和密码登录
- 注册申请与管理员审核
- 用户启用、停用和角色管理
- 登录用户自助修改密码，并注销其他设备会话
- 可选的独立 Node 网关，通过 HMAC 签名接收开门命令
- WebAuthn 通行密钥，兼容 Apple iCloud 钥匙串、面容 ID 和触控 ID
- D1 用户、会话、凭据和审计日志存储
- 门锁 API 凭据通过 Cloudflare Secret 注入

## 本地开发

需要 Node.js 20 或更高版本。

```bash
npm install
npm run db:migrate:local
npm start
```

本地服务默认运行在 <http://localhost:8787>。门锁代理需要在 `.dev.vars` 中配置 `UPSTREAM_REQUEST`；该文件已被 `.gitignore` 排除。

## Cloudflare 部署

首次部署需创建 D1、应用迁移并配置门锁 Secret：

```bash
npx wrangler login
npm run db:migrate:remote
npx wrangler secret put UPSTREAM_REQUEST
npm run deploy
```

`UPSTREAM_REQUEST` 使用以下 JSON 结构：

```json
{
  "url": "https://example.com/path/to/open-door",
  "token": "secret-token",
  "body": {
    "houseHostId": "...",
    "peopleId": "...",
    "roleType": "0"
  },
  "userAgent": "...",
  "referer": "..."
}
```

不要将 Secret、原始抓包或生产 Nginx 配置提交到仓库。

## Node 网关

另一台服务器可运行独立网关，由网关直接连接门锁。网关主动通过 HTTPS 轮询网站获取命令，不需要域名、证书或公网入站端口。

在网关服务器创建 `.env.gateway`：

```bash
HOST=127.0.0.1
PORT=8788
CONTROL_PLANE_URL=https://door.example.com
GATEWAY_SHARED_SECRET=至少32位随机字符串
UPSTREAM_REQUEST_BASE64=完整上游请求JSON的Base64编码
```

建议使用 `openssl rand -hex 32` 生成共享密钥。将现有 `UPSTREAM_REQUEST` JSON 编码为单行 Base64 后写入网关环境文件，避免 token、User-Agent 和空格被 systemd 错误解析：

```bash
printf '%s' "$UPSTREAM_REQUEST" | base64 | tr -d '\n'
```

启动并检查：

```bash
set -a
source .env.gateway
set +a
npm run gateway:start
curl http://127.0.0.1:8788/health
```

仓库提供 [systemd](gateway/door-gateway.service.example) 示例。Cloudflare Worker 只需设置与网关相同的共享密钥：

```bash
printf '%s' '至少32位随机字符串' | npx wrangler secret put GATEWAY_SHARED_SECRET
```

设置 Secret 后，点击开门会在 D1 创建一次性命令；网关领取、执行并回报结果。网站最多等待 20 秒并显示门锁返回内容。网关与网站之间始终使用现有 `https://door.example.com`，服务器无需开放 80 或 8788。未设置共享密钥时 Worker 保留原有直连逻辑。

## 安全模型

公开注册创建的账号状态为 `pending`，管理员批准前不能登录或操作门锁。会话 Cookie 使用 `HttpOnly`、`Secure` 和 `SameSite=Strict`，所有写请求还会验证同源信息和应用请求头。密码使用 PBKDF2-SHA256 哈希，通行密钥通过 SimpleWebAuthn 校验。

通行密钥与注册时的域名绑定。切换自定义域名时，应先配置 `RP_ORIGIN` 和 `RP_ID`，然后让用户在新域名重新添加通行密钥。
