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

export function resolveGatewayEndpoint(env) {
  if (!env.GATEWAY_URL || !env.GATEWAY_SHARED_SECRET) {
    throw new Error("门禁网关尚未完整配置");
  }

  const url = new URL(env.GATEWAY_URL);
  const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);
  const insecureHttpAllowed = env.ALLOW_INSECURE_GATEWAY === "true";
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && (localDevelopment || insecureHttpAllowed))
  ) {
    throw new Error("公网 HTTP 网关需要显式启用 ALLOW_INSECURE_GATEWAY");
  }
  url.pathname = "/v1/open-door";
  url.search = "";
  return url;
}

export async function requestGatewayOpenDoor(env) {
  const url = resolveGatewayEndpoint(env);

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

export async function requestGatewayHealth(env) {
  const url = resolveGatewayEndpoint(env);
  url.pathname = "/health";
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10_000);

  try {
    const response = await fetch(url, { signal: abortController.signal });
    const text = await response.text();
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      body: text.slice(0, 200)
    };
  } finally {
    clearTimeout(timeout);
  }
}
