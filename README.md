# 智能门禁

部署在 Cloudflare Workers 的门禁控制与用户管理系统。支持：

- 用户名和密码登录
- 注册申请与管理员审核
- 用户启用、停用和角色管理
- 登录用户自助修改密码，并注销其他设备会话
- 管理员配置和测试 SOCKS5 出口，开门请求可按配置走代理
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

代理密码使用 AES-256-GCM 加密后存入 D1，密钥通过 `PROXY_CONFIG_KEY` Secret 注入：

```bash
openssl rand -base64 32 | npx wrangler secret put PROXY_CONFIG_KEY
```

代理服务器必须具有 Cloudflare 可访问的公网主机和端口。管理员可在“代理设置”中保存配置；测试操作会通过代理向门锁上游发送不含 token 的 `HEAD` 请求，并将出口 IP 查询作为辅助信息，不会触发开门。

## 安全模型

公开注册创建的账号状态为 `pending`，管理员批准前不能登录或操作门锁。会话 Cookie 使用 `HttpOnly`、`Secure` 和 `SameSite=Strict`，所有写请求还会验证同源信息和应用请求头。密码使用 PBKDF2-SHA256 哈希，通行密钥通过 SimpleWebAuthn 校验。

通行密钥与注册时的域名绑定。切换自定义域名时，应先配置 `RP_ORIGIN` 和 `RP_ID`，然后让用户在新域名重新添加通行密钥。
