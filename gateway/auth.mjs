import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_WINDOW_MS = 60_000;

export function createGatewaySignature(secret, timestamp, nonce, body) {
  if (!secret || secret.length < 32) throw new Error("GATEWAY_SHARED_SECRET must be at least 32 characters");
  return createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest("base64url");
}

export class ReplayCache {
  constructor() {
    this.entries = new Map();
  }

  consume(nonce, currentTime = Date.now()) {
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= currentTime) this.entries.delete(key);
    }
    if (this.entries.has(nonce)) return false;
    this.entries.set(nonce, currentTime + SIGNATURE_WINDOW_MS);
    return true;
  }
}

export function verifyGatewayRequest(headers, body, secret, replayCache, currentTime = Date.now()) {
  const timestampValue = headers.get("x-gateway-timestamp") ?? "";
  const nonce = headers.get("x-gateway-nonce") ?? "";
  const provided = headers.get("x-gateway-signature") ?? "";
  const timestamp = Number.parseInt(timestampValue, 10);

  if (!Number.isFinite(timestamp) || Math.abs(currentTime - timestamp) > SIGNATURE_WINDOW_MS) {
    return { valid: false, reason: "请求时间戳无效或已过期" };
  }
  if (!/^[a-f0-9-]{36}$/i.test(nonce)) {
    return { valid: false, reason: "请求 nonce 无效" };
  }

  const expected = createGatewaySignature(secret, timestampValue, nonce, body);
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (
    expectedBytes.length !== providedBytes.length ||
    !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    return { valid: false, reason: "请求签名无效" };
  }
  if (!replayCache.consume(nonce, currentTime)) {
    return { valid: false, reason: "请求已处理" };
  }

  return { valid: true };
}
