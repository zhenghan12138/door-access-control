import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { ReplayCache, verifyGatewayRequest } from "./auth.mjs";

const MAX_BODY_BYTES = 16_384;
const replayCache = new ReplayCache();
let activeRequests = 0;

function jsonResponse(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff"
  });
  response.end(payload);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("请求体过大");
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function loadUpstreamRequest(env) {
  const raw = env.UPSTREAM_REQUEST_BASE64
    ? Buffer.from(env.UPSTREAM_REQUEST_BASE64, "base64").toString("utf8")
    : env.UPSTREAM_REQUEST;
  const config = JSON.parse(raw ?? "");
  if (!config.url || !config.token || !config.body) {
    throw new Error("UPSTREAM_REQUEST 配置不完整");
  }
  return config;
}

async function openDoor(env) {
  const config = loadUpstreamRequest(env);
  const url = new URL(config.url);
  url.searchParams.set("token", config.token);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 15_000);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        token: config.token,
        ...(config.userAgent && { "user-agent": config.userAgent }),
        ...(config.referer && { referer: config.referer })
      },
      body: JSON.stringify(config.body),
      signal: abortController.signal
    });
    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text || "门锁服务返回了无法识别的内容" };
    }

    return {
      status: upstream.ok ? 200 : 502,
      body: {
        success: upstream.ok && data?.status === "1",
        status: data?.status,
        result: data?.result,
        code: data?.code,
        message: data?.message ?? "开门请求失败"
      }
    };
  } catch (error) {
    return {
      status: 502,
      body: {
        success: false,
        message: error?.name === "AbortError" ? "门锁响应超时，请稍后重试" : "无法连接门锁服务"
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function controlPlaneRequest(env, path, body = {}) {
  if (!env.CONTROL_PLANE_URL || !env.GATEWAY_SHARED_SECRET) {
    throw new Error("CONTROL_PLANE_URL 或 GATEWAY_SHARED_SECRET 未配置");
  }
  const url = new URL(env.CONTROL_PLANE_URL);
  const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Error("CONTROL_PLANE_URL 必须使用 HTTPS");
  }
  url.pathname = path;
  url.search = "";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.GATEWAY_SHARED_SECRET}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({ message: "控制端返回了无法识别的内容" }));
  if (!response.ok) throw new Error(data.message ?? `控制端 HTTP ${response.status}`);
  return data;
}

function delay(milliseconds, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export async function runGatewayPoller(env = process.env, signal) {
  while (!signal?.aborted) {
    try {
      const { command } = await controlPlaneRequest(env, "/api/gateway/pull");
      if (!command) {
        await delay(750, signal);
        continue;
      }

      const outcome = await openDoor(env);
      await controlPlaneRequest(env, "/api/gateway/result", {
        id: command.id,
        ...outcome.body
      });
    } catch (error) {
      console.error(`Gateway poll failed: ${error?.name ?? "Error"}: ${String(error?.message ?? "未知错误").slice(0, 160)}`);
      await delay(2_000, signal);
    }
  }
}

export function createGatewayServer(env = process.env) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && url.pathname === "/health") {
        jsonResponse(response, 200, {
          status: "ok",
          mode: env.CONTROL_PLANE_URL ? "pull" : "push"
        });
        return;
      }

      if (request.method !== "POST" || url.pathname !== "/v1/open-door") {
        jsonResponse(response, 404, { message: "Not Found" });
        return;
      }
      if (activeRequests >= 3) {
        jsonResponse(response, 429, { success: false, message: "网关请求繁忙" });
        return;
      }

      const rawBody = await readBody(request);
      const verification = verifyGatewayRequest(
        new Headers(request.headers),
        rawBody,
        env.GATEWAY_SHARED_SECRET,
        replayCache
      );
      if (!verification.valid) {
        jsonResponse(response, 401, { success: false, message: verification.reason });
        return;
      }

      const command = JSON.parse(rawBody);
      if (command?.action !== "open-door") {
        jsonResponse(response, 400, { success: false, message: "命令无效" });
        return;
      }

      activeRequests += 1;
      try {
        const result = await openDoor(env);
        jsonResponse(response, result.status, result.body);
      } finally {
        activeRequests -= 1;
      }
    } catch (error) {
      console.error(`Gateway request failed: ${error?.name ?? "Error"}: ${String(error?.message ?? "未知错误").slice(0, 160)}`);
      jsonResponse(response, 500, { success: false, message: "网关内部错误" });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number.parseInt(process.env.PORT ?? "8788", 10);
  const server = createGatewayServer();
  const pollAbortController = new AbortController();
  if (process.env.CONTROL_PLANE_URL) {
    void runGatewayPoller(process.env, pollAbortController.signal);
  }
  server.listen(port, host, () => {
    console.log(`Door gateway listening on http://${host}:${port}`);
  });

  const shutdown = () => {
    pollAbortController.abort();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
