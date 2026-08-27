import { fromBase64Url, toBase64Url } from "./lib.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function validateProxyInput(input, { passwordRequired = false } = {}) {
  const host = String(input?.host ?? "").trim();
  const port = Number.parseInt(input?.port, 10);
  const username = String(input?.username ?? "").trim();
  const password = String(input?.password ?? "");

  if (!host || host.length > 253 || !/^[a-zA-Z0-9.-]+$/.test(host)) {
    throw new Error("代理主机地址无效");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("代理端口需为 1-65535");
  }
  if (username.length > 255 || password.length > 255) {
    throw new Error("代理用户名或密码过长");
  }
  if (passwordRequired && username && !password) {
    throw new Error("请输入代理密码");
  }

  return {
    enabled: Boolean(input?.enabled),
    host,
    port,
    username,
    password
  };
}

async function encryptionKey(secret, usage) {
  if (!secret) throw new Error("PROXY_CONFIG_KEY is not configured");
  const raw = fromBase64Url(secret);
  if (raw.length !== 32) throw new Error("PROXY_CONFIG_KEY must contain 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [usage]);
}

export async function encryptProxyPassword(password, secret) {
  if (!password) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(secret, "encrypt"),
    encoder.encode(password)
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

export async function decryptProxyPassword(value, secret) {
  if (!value) return "";
  const [version, iv, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !ciphertext) throw new Error("代理密码密文无效");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv) },
    await encryptionKey(secret, "decrypt"),
    fromBase64Url(ciphertext)
  );
  return decoder.decode(plaintext);
}

export async function loadProxySettings(env) {
  const row = await env.DB.prepare(
    "SELECT enabled, host, port, username, password_encrypted FROM proxy_settings WHERE id = 1"
  ).first();
  if (!row) return null;

  return {
    enabled: Boolean(row.enabled),
    host: row.host,
    port: row.port,
    username: row.username ?? "",
    password: await decryptProxyPassword(row.password_encrypted, env.PROXY_CONFIG_KEY),
    hasPassword: Boolean(row.password_encrypted)
  };
}
