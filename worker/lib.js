const encoder = new TextEncoder();

export const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'none'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'"
  ].join("; "),
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

export function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

export function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function now() {
  return Math.floor(Date.now() / 1000);
}

export function toBase64Url(bytes) {
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  for (const byte of view) binary += String.fromCharCode(byte);

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function fromBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function constantTimeEqual(left, right) {
  const a = typeof left === "string" ? encoder.encode(left) : left;
  const b = typeof right === "string" ? encoder.encode(right) : right;
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }

  return mismatch === 0;
}

export async function sha256(value) {
  return toBase64Url(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function hashPassword(password, iterations = 310_000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits"
  ]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );

  return `pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

export async function verifyPassword(password, encodedHash) {
  const [algorithm, iterationsValue, saltValue, expectedValue] = encodedHash.split("$");
  const iterations = Number.parseInt(iterationsValue, 10);

  if (algorithm !== "pbkdf2_sha256" || !iterations || !saltValue || !expectedValue) return false;

  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits"
  ]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(saltValue), iterations },
    key,
    256
  );

  return constantTimeEqual(new Uint8Array(derived), fromBase64Url(expectedValue));
}

export async function burnPasswordCheck(password) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits"
  ]);
  await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode("door-access-dummy"),
      iterations: 310_000
    },
    key,
    256
  );
}

export function validateUsername(username) {
  return typeof username === "string" && /^[\p{L}\p{N}._-]{3,32}$/u.test(username.trim());
}

export function validatePassword(password) {
  return typeof password === "string" && password.length >= 10 && password.length <= 128;
}

export async function readJson(request) {
  const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);

  if (contentLength > 32_768) throw new Error("REQUEST_TOO_LARGE");

  return request.json();
}

export function isTrustedMutation(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && origin !== url.origin) return false;
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  return request.headers.get("x-requested-with") === "door-access";
}

export function getCookie(request, name) {
  const cookies = request.headers.get("cookie") ?? "";

  for (const item of cookies.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }

  return null;
}

export function sessionCookie(token, maxAge = 60 * 60 * 24 * 30) {
  return [
    `door_session=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict"
  ].join("; ");
}

export function clearSessionCookie() {
  return "door_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict";
}

export async function clientIpHash(request) {
  return sha256(request.headers.get("cf-connecting-ip") ?? "local");
}

export async function createSession(env, request, userId) {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const createdAt = now();

  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at, user_agent, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      tokenHash,
      userId,
      createdAt + 60 * 60 * 24 * 30,
      createdAt,
      (request.headers.get("user-agent") ?? "").slice(0, 300),
      await clientIpHash(request)
    )
    .run();

  return token;
}

export async function getSessionUser(env, request) {
  const token = getCookie(request, "door_session");
  if (!token) return null;

  return env.DB.prepare(
    `SELECT users.id, users.username, users.role, users.status, users.created_at,
            sessions.token_hash AS session_token_hash
       FROM sessions
       JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?`
  )
    .bind(await sha256(token), now())
    .first();
}

export function publicUser(user, passkeyCount = undefined) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    ...(passkeyCount !== undefined && { passkeyCount })
  };
}

export async function writeAudit(env, request, action, actorUserId = null, targetUserId = null) {
  await env.DB.prepare(
    `INSERT INTO audit_logs (actor_user_id, action, target_user_id, created_at, ip_hash)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(actorUserId, action, targetUserId, now(), await clientIpHash(request))
    .run();
}
