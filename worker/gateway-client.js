import { toBase64Url } from "./lib.js";

async function createSignature(secret, timestamp, nonce, body) {
  if (!secret || secret.length < 32) {
    throw new Error("GATEWAY_SHARED_SECRET 配置无效");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toBase64Url(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${nonce}.${body}`)
    )
  );
}

export async function createGatewayHeaders(secret, body, timestamp = String(Date.now()), nonce = crypto.randomUUID()) {
  return {
    "content-type": "application/json",
    "x-gateway-timestamp": timestamp,
    "x-gateway-nonce": nonce,
    "x-gateway-signature": await createSignature(secret, timestamp, nonce, body)
  };
}

export async function requestGatewayOpenDoor(env) {
  if (!env.GATEWAY_URL || !env.GATEWAY_SHARED_SECRET) {
    throw new Error("门禁网关尚未完整配置");
  }

  const url = new URL(env.GATEWAY_URL);
  const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Error("门禁网关必须使用 HTTPS");
  }
  url.pathname = "/v1/open-door";
  url.search = "";

  const body = JSON.stringify({ action: "open-door" });
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 20_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: await createGatewayHeaders(env.GATEWAY_SHARED_SECRET, body),
      body,
      signal: abortController.signal
    });
    const data = await response.json().catch(() => ({ message: "网关返回了无法识别的内容" }));
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}
