import { Buffer } from "node:buffer";
import { connect as connectTls } from "node:tls";
import { SocksClient } from "socks";

function decodeChunkedBody(buffer) {
  const chunks = [];
  let offset = 0;

  while (offset < buffer.length) {
    const lineEnd = buffer.indexOf("\r\n", offset);
    if (lineEnd === -1) throw new Error("代理响应分块格式无效");
    const size = Number.parseInt(buffer.subarray(offset, lineEnd).toString("ascii").split(";", 1)[0], 16);
    if (!Number.isFinite(size)) throw new Error("代理响应分块大小无效");
    if (size === 0) break;

    const start = lineEnd + 2;
    const end = start + size;
    if (end + 2 > buffer.length) throw new Error("代理响应内容不完整");
    chunks.push(buffer.subarray(start, end));
    offset = end + 2;
  }

  return Buffer.concat(chunks);
}

function parseHttpResponse(buffer) {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd === -1) throw new Error("目标服务响应格式无效");

  const headerLines = buffer.subarray(0, headerEnd).toString("latin1").split("\r\n");
  const statusMatch = headerLines.shift()?.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/);
  if (!statusMatch) throw new Error("目标服务响应状态无效");

  const headers = new Headers();
  for (const line of headerLines) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!["connection", "transfer-encoding", "content-length"].includes(name.toLowerCase())) {
      headers.append(name, value);
    }
  }

  const chunked = headerLines.some((line) => /^transfer-encoding:\s*chunked/i.test(line));
  const rawBody = buffer.subarray(headerEnd + 4);
  return new Response(chunked ? decodeChunkedBody(rawBody) : rawBody, {
    status: Number.parseInt(statusMatch[1], 10),
    headers
  });
}

export async function socksRequest(proxy, targetUrl, options = {}) {
  const url = new URL(targetUrl);
  if (url.protocol !== "https:") throw new Error("代理请求仅允许 HTTPS 目标");

  const { socket } = await SocksClient.createConnection({
    proxy: {
      host: proxy.host,
      port: proxy.port,
      type: 5,
      ...(proxy.username && { userId: proxy.username, password: proxy.password })
    },
    command: "connect",
    destination: {
      host: url.hostname,
      port: Number.parseInt(url.port || "443", 10)
    },
    timeout: options.timeout ?? 15_000
  });

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;
    const tlsSocket = connectTls({ socket, servername: url.hostname });

    const finishWithError = (error) => {
      if (settled) return;
      settled = true;
      tlsSocket.destroy();
      reject(error);
    };

    tlsSocket.once("secureConnect", () => {
      const method = options.method ?? "GET";
      const body = options.body ? Buffer.from(options.body) : Buffer.alloc(0);
      const headers = new Headers(options.headers ?? {});
      headers.set("host", url.port ? `${url.hostname}:${url.port}` : url.hostname);
      headers.set("connection", "close");
      if (body.length) headers.set("content-length", String(body.length));

      const headerText = [...headers]
        .map(([name, value]) => `${name}: ${String(value).replace(/[\r\n]/g, "")}`)
        .join("\r\n");
      tlsSocket.write(`${method} ${url.pathname}${url.search} HTTP/1.1\r\n${headerText}\r\n\r\n`);
      if (body.length) tlsSocket.write(body);
      tlsSocket.end();
    });

    tlsSocket.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > 1_048_576) {
        finishWithError(new Error("目标服务响应超过 1 MiB"));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    tlsSocket.once("error", finishWithError);
    tlsSocket.once("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve(parseHttpResponse(Buffer.concat(chunks)));
      } catch (error) {
        reject(error);
      }
    });

    if (typeof tlsSocket.setTimeout === "function") {
      tlsSocket.setTimeout(options.timeout ?? 15_000, () => {
        const error = new Error("代理连接超时");
        error.name = "TimeoutError";
        finishWithError(error);
      });
    }
  });
}
