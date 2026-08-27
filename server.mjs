import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const host = process.env.HOST ?? "127.0.0.1";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

async function loadCapturedRequest() {
  const files = await readdir(root);
  const captureName = files.find(
    (name) => name.includes("Request -") && name.includes("commandByHouseHostId")
  );

  if (!captureName) {
    throw new Error("未找到 commandByHouseHostId 请求抓包文件");
  }

  const raw = await readFile(join(root, captureName), "utf8");
  const [requestLine = ""] = raw.split(/\r?\n/);
  const requestMatch = requestLine.match(/^POST\s+(\S+)\s+HTTP\/\d(?:\.\d)?$/);
  const hostMatch = raw.match(/^Host:\s*(.+)$/im);
  const tokenMatch = raw.match(/^token:\s*(.+)$/im);
  const userAgentMatch = raw.match(/^User-Agent:\s*(.+)$/im);
  const refererMatch = raw.match(/^Referer:\s*(.+)$/im);
  const bodyStart = raw.indexOf("{");

  if (!requestMatch || !hostMatch || !tokenMatch || bodyStart === -1) {
    throw new Error("请求抓包内容不完整");
  }

  const body = JSON.stringify(JSON.parse(raw.slice(bodyStart)));

  return {
    url: `https://${hostMatch[1].trim()}${requestMatch[1]}`,
    body,
    headers: {
      "content-type": "application/json",
      token: tokenMatch[1].trim(),
      ...(userAgentMatch && { "user-agent": userAgentMatch[1].trim() }),
      ...(refererMatch && { referer: refererMatch[1].trim() })
    }
  };
}

const capturedRequest = await loadCapturedRequest();

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": mimeTypes[".json"]
  });
  response.end(JSON.stringify(body));
}

async function openDoor(response) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 15_000);

  try {
    const upstream = await fetch(capturedRequest.url, {
      method: "POST",
      headers: capturedRequest.headers,
      body: capturedRequest.body,
      signal: abortController.signal
    });
    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text || "接口返回了无法识别的内容" };
    }

    sendJson(response, upstream.ok ? 200 : 502, {
      success: upstream.ok && data?.status === "1",
      status: data?.status,
      result: data?.result,
      code: data?.code,
      message: data?.message ?? "开门请求失败"
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    sendJson(response, 502, {
      success: false,
      message: timedOut ? "门锁响应超时，请稍后重试" : "无法连接门锁服务"
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const relativePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, relativePath);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "cache-control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=86400",
      "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream"
    });
    response.end(content);
  } catch (error) {
    response.writeHead(error?.code === "ENOENT" ? 404 : 500);
    response.end(error?.code === "ENOENT" ? "Not Found" : "Server Error");
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/open-door") {
    await openDoor(response);
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(request, response);
    return;
  }

  response.writeHead(405, { allow: "GET, HEAD, POST" });
  response.end("Method Not Allowed");
});

server.listen(port, host, () => {
  console.log(`门禁控制页面已启动：http://${host}:${port}`);
});
