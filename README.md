# 门禁控制页面

一个受密码保护的门禁控制页。前端静态资源和 API 代理部署在 Cloudflare Workers；门锁 token 和请求参数仅保存在 Cloudflare Secrets 中，不会进入 Git 仓库或发送到浏览器。

## 本地运行

需要 Node.js 18 或更高版本。将原始 `commandByHouseHostId` 请求抓包放在项目根目录后运行：

```bash
npm start
```

打开 <http://127.0.0.1:4173>。本地服务器读取抓包并代理请求，抓包文件已被 `.gitignore` 排除。

## Cloudflare 部署

首次部署前登录并设置三个 Secret：

```bash
npx wrangler login
npx wrangler secret put ACCESS_USERNAME
npx wrangler secret put ACCESS_PASSWORD
npx wrangler secret put UPSTREAM_REQUEST
npm run deploy
```

`UPSTREAM_REQUEST` 是以下结构的 JSON 字符串：

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

Worker 对整个站点启用 HTTP Basic Auth，并验证开门请求的来源和自定义请求头。不要将上述 Secret 写入仓库。
