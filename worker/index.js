import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";

import {
  burnPasswordCheck,
  clearSessionCookie,
  clientIpHash,
  constantTimeEqual,
  createSession,
  getSessionUser,
  hashPassword,
  isTrustedMutation,
  jsonResponse,
  now,
  publicUser,
  readJson,
  sessionCookie,
  sha256,
  validatePassword,
  validateUsername,
  verifyPassword,
  withSecurityHeaders,
  writeAudit
} from "./lib.js";
import { requestGatewayHealth, requestGatewayOpenDoor } from "./gateway-client.js";

const encoder = new TextEncoder();

function relyingParty(request, env) {
  const requestUrl = new URL(request.url);
  const origin = env.RP_ORIGIN ?? requestUrl.origin;

  return {
    name: env.RP_NAME ?? "智能门禁",
    origin,
    id: env.RP_ID ?? new URL(origin).hostname
  };
}

function parseTransports(value) {
  try {
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
}

async function requireActiveUser(env, request) {
  const user = await getSessionUser(env, request);
  return user?.status === "active" ? user : null;
}

async function checkLoginLimit(env, request, username) {
  const keyHash = await sha256(
    `${await clientIpHash(request)}:${String(username).trim().toLocaleLowerCase()}`
  );
  const currentTime = now();
  const record = await env.DB.prepare(
    "SELECT attempts, window_started_at FROM login_limits WHERE key_hash = ?"
  )
    .bind(keyHash)
    .first();

  if (!record || currentTime - record.window_started_at >= 15 * 60) {
    await env.DB.prepare(
      `INSERT INTO login_limits (key_hash, attempts, window_started_at) VALUES (?, 1, ?)
       ON CONFLICT(key_hash) DO UPDATE SET attempts = 1, window_started_at = excluded.window_started_at`
    )
      .bind(keyHash, currentTime)
      .run();
    return { allowed: true, keyHash };
  }

  if (record.attempts >= 10) return { allowed: false, keyHash };

  await env.DB.prepare("UPDATE login_limits SET attempts = attempts + 1 WHERE key_hash = ?")
    .bind(keyHash)
    .run();
  return { allowed: true, keyHash };
}

async function handleRegister(request, env) {
  const { username, password } = await readJson(request);
  const normalizedUsername = String(username ?? "").trim();
  const limit = await checkLoginLimit(env, request, "registration");

  if (!limit.allowed) {
    return jsonResponse(429, { message: "注册申请过多，请 15 分钟后再试" });
  }

  if (!validateUsername(normalizedUsername)) {
    return jsonResponse(400, { message: "用户名需为 3-32 个字符，仅支持文字、数字、点、横线和下划线" });
  }

  if (!validatePassword(password)) {
    return jsonResponse(400, { message: "密码长度需为 10-128 个字符" });
  }

  const id = crypto.randomUUID();
  const timestamp = now();

  try {
    await env.DB.prepare(
      `INSERT INTO users (id, username, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, ?, 'user', 'pending', ?, ?)`
    )
      .bind(id, normalizedUsername, await hashPassword(password), timestamp, timestamp)
      .run();
  } catch (error) {
    if (String(error?.message).includes("UNIQUE")) {
      return jsonResponse(409, { message: "该用户名已被使用" });
    }
    throw error;
  }

  await writeAudit(env, request, "user.register", id, id);
  return jsonResponse(201, { message: "注册申请已提交，请等待管理员审核" });
}

async function handlePasswordLogin(request, env) {
  const { username, password } = await readJson(request);
  const normalizedUsername = String(username ?? "").trim();
  const limit = await checkLoginLimit(env, request, normalizedUsername);

  if (!limit.allowed) {
    return jsonResponse(429, { message: "登录尝试过多，请 15 分钟后再试" });
  }

  const user = await env.DB.prepare(
    "SELECT id, username, password_hash, role, status, created_at FROM users WHERE username = ?"
  )
    .bind(normalizedUsername)
    .first();
  const passwordMatches = user
    ? await verifyPassword(String(password ?? ""), user.password_hash)
    : await burnPasswordCheck(String(password ?? "")).then(() => false);

  if (!passwordMatches) {
    return jsonResponse(401, { message: "用户名或密码不正确" });
  }

  if (user.status !== "active") {
    return jsonResponse(403, {
      message: user.status === "pending" ? "账号正在等待管理员审核" : "账号已停用"
    });
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_limits WHERE key_hash = ?").bind(limit.keyHash),
    env.DB.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").bind(
      now(),
      now(),
      user.id
    )
  ]);
  const token = await createSession(env, request, user.id);
  await writeAudit(env, request, "auth.password_login", user.id, user.id);

  return jsonResponse(200, { user: publicUser(user) }, { "set-cookie": sessionCookie(token) });
}

async function handlePasswordChange(request, env) {
  const user = await requireActiveUser(env, request);
  if (!user) return jsonResponse(401, { message: "请先登录" });

  const { currentPassword, newPassword } = await readJson(request);
  if (!validatePassword(newPassword)) {
    return jsonResponse(400, { message: "新密码长度需为 10-128 个字符" });
  }
  if (currentPassword === newPassword) {
    return jsonResponse(400, { message: "新密码不能与当前密码相同" });
  }

  const account = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(user.id)
    .first();
  if (!account || !(await verifyPassword(String(currentPassword ?? ""), account.password_hash))) {
    return jsonResponse(401, { message: "当前密码不正确" });
  }

  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(
      await hashPassword(newPassword),
      timestamp,
      user.id
    ),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?").bind(
      user.id,
      user.session_token_hash
    )
  ]);
  await writeAudit(env, request, "auth.password_change", user.id, user.id);

  return jsonResponse(200, { success: true, message: "密码已更新，其他设备已退出登录" });
}

async function handleLogout(request, env) {
  const user = await getSessionUser(env, request);

  if (user?.session_token_hash) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(user.session_token_hash)
      .run();
    await writeAudit(env, request, "auth.logout", user.id, user.id);
  }

  return jsonResponse(200, { success: true }, { "set-cookie": clearSessionCookie() });
}

async function handleMe(request, env) {
  const user = await requireActiveUser(env, request);

  if (!user) {
    return jsonResponse(401, { message: "请先登录" }, { "set-cookie": clearSessionCookie() });
  }

  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM passkeys WHERE user_id = ?")
    .bind(user.id)
    .first();
  return jsonResponse(200, { user: publicUser(user, count?.count ?? 0) });
}

async function saveChallenge(env, challenge, kind, userId = null) {
  const id = crypto.randomUUID();
  const createdAt = now();

  await env.DB.prepare(
    `INSERT INTO webauthn_challenges (id, challenge, user_id, kind, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, challenge, userId, kind, createdAt + 5 * 60, createdAt)
    .run();

  return id;
}

async function consumeChallenge(env, challengeId, kind) {
  const challenge = await env.DB.prepare(
    `SELECT id, challenge, user_id FROM webauthn_challenges
      WHERE id = ? AND kind = ? AND expires_at > ?`
  )
    .bind(challengeId, kind, now())
    .first();

  if (challenge) {
    await env.DB.prepare("DELETE FROM webauthn_challenges WHERE id = ?").bind(challenge.id).run();
  }

  return challenge;
}

async function handlePasskeyRegistrationOptions(request, env) {
  const user = await requireActiveUser(env, request);
  if (!user) return jsonResponse(401, { message: "请先登录" });

  const { results: existingPasskeys } = await env.DB.prepare(
    "SELECT id, transports FROM passkeys WHERE user_id = ?"
  )
    .bind(user.id)
    .all();
  const rp = relyingParty(request, env);
  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userID: encoder.encode(user.id),
    userName: user.username,
    userDisplayName: user.username,
    attestationType: "none",
    excludeCredentials: existingPasskeys.map((passkey) => ({
      id: passkey.id,
      transports: parseTransports(passkey.transports)
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required"
    }
  });

  return jsonResponse(200, {
    challengeId: await saveChallenge(env, options.challenge, "registration", user.id),
    options
  });
}

async function handlePasskeyRegistrationVerify(request, env) {
  const user = await requireActiveUser(env, request);
  if (!user) return jsonResponse(401, { message: "请先登录" });

  const { challengeId, response, name } = await readJson(request);
  const challenge = await consumeChallenge(env, challengeId, "registration");

  if (!challenge || challenge.user_id !== user.id) {
    return jsonResponse(400, { message: "通行密钥请求已失效，请重试" });
  }

  const rp = relyingParty(request, env);
  let verification;

  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: true
    });
  } catch {
    return jsonResponse(400, { message: "无法验证该通行密钥" });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return jsonResponse(400, { message: "通行密钥验证失败" });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const passkeyName = String(name ?? "Apple 通行密钥").trim().slice(0, 40) || "Apple 通行密钥";

  try {
    await env.DB.prepare(
      `INSERT INTO passkeys
       (id, user_id, public_key, counter, transports, device_type, backed_up, name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        credential.id,
        user.id,
        credential.publicKey,
        credential.counter,
        JSON.stringify(response.response?.transports ?? credential.transports ?? []),
        credentialDeviceType,
        credentialBackedUp ? 1 : 0,
        passkeyName,
        now()
      )
      .run();
  } catch (error) {
    if (String(error?.message).includes("UNIQUE")) {
      return jsonResponse(409, { message: "该通行密钥已经绑定" });
    }
    throw error;
  }

  await writeAudit(env, request, "passkey.create", user.id, user.id);
  return jsonResponse(201, { success: true, message: "通行密钥已添加" });
}

async function handlePasskeyAuthenticationOptions(request, env) {
  const body = await readJson(request);
  const username = String(body?.username ?? "").trim();
  const rp = relyingParty(request, env);
  let allowCredentials;
  let userId = null;

  if (username) {
    const user = await env.DB.prepare("SELECT id, status FROM users WHERE username = ?")
      .bind(username)
      .first();

    if (user?.status === "active") {
      userId = user.id;
      const { results } = await env.DB.prepare(
        "SELECT id, transports FROM passkeys WHERE user_id = ?"
      )
        .bind(user.id)
        .all();
      allowCredentials = results.map((passkey) => ({
        id: passkey.id,
        transports: parseTransports(passkey.transports)
      }));
    } else {
      allowCredentials = [];
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: rp.id,
    userVerification: "required",
    ...(allowCredentials !== undefined && { allowCredentials })
  });

  return jsonResponse(200, {
    challengeId: await saveChallenge(env, options.challenge, "authentication", userId),
    options
  });
}

async function handlePasskeyAuthenticationVerify(request, env) {
  const { challengeId, response } = await readJson(request);
  const challenge = await consumeChallenge(env, challengeId, "authentication");

  if (!challenge) return jsonResponse(400, { message: "登录请求已失效，请重试" });

  const passkey = await env.DB.prepare(
    `SELECT passkeys.id, passkeys.user_id, passkeys.public_key, passkeys.counter,
            passkeys.transports, users.username, users.role, users.status, users.created_at
       FROM passkeys
       JOIN users ON users.id = passkeys.user_id
      WHERE passkeys.id = ?`
  )
    .bind(response?.id ?? "")
    .first();

  if (!passkey || passkey.status !== "active" || (challenge.user_id && challenge.user_id !== passkey.user_id)) {
    return jsonResponse(401, { message: "无法使用该通行密钥登录" });
  }

  const rp = relyingParty(request, env);
  let verification;

  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: true,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.public_key),
        counter: passkey.counter,
        transports: parseTransports(passkey.transports)
      }
    });
  } catch {
    return jsonResponse(401, { message: "通行密钥验证失败" });
  }

  if (!verification.verified) return jsonResponse(401, { message: "通行密钥验证失败" });

  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?").bind(
      verification.authenticationInfo.newCounter,
      timestamp,
      passkey.id
    ),
    env.DB.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").bind(
      timestamp,
      timestamp,
      passkey.user_id
    )
  ]);
  const token = await createSession(env, request, passkey.user_id);
  await writeAudit(env, request, "auth.passkey_login", passkey.user_id, passkey.user_id);

  return jsonResponse(
    200,
    {
      user: publicUser({
        id: passkey.user_id,
        username: passkey.username,
        role: passkey.role,
        status: passkey.status,
        created_at: passkey.created_at
      })
    },
    { "set-cookie": sessionCookie(token) }
  );
}

async function handleListPasskeys(request, env) {
  const user = await requireActiveUser(env, request);
  if (!user) return jsonResponse(401, { message: "请先登录" });

  const { results } = await env.DB.prepare(
    `SELECT id, name, device_type, backed_up, created_at, last_used_at
       FROM passkeys WHERE user_id = ? ORDER BY created_at DESC`
  )
    .bind(user.id)
    .all();

  return jsonResponse(200, {
    passkeys: results.map((passkey) => ({
      id: passkey.id,
      name: passkey.name,
      deviceType: passkey.device_type,
      backedUp: Boolean(passkey.backed_up),
      createdAt: passkey.created_at,
      lastUsedAt: passkey.last_used_at
    }))
  });
}

async function handleDeletePasskey(request, env, passkeyId) {
  const user = await requireActiveUser(env, request);
  if (!user) return jsonResponse(401, { message: "请先登录" });

  const result = await env.DB.prepare("DELETE FROM passkeys WHERE id = ? AND user_id = ?")
    .bind(passkeyId, user.id)
    .run();

  if (!result.meta.changes) return jsonResponse(404, { message: "未找到该通行密钥" });

  await writeAudit(env, request, "passkey.delete", user.id, user.id);
  return jsonResponse(200, { success: true });
}

async function handleListUsers(request, env) {
  const user = await requireActiveUser(env, request);
  if (!user || user.role !== "admin") return jsonResponse(403, { message: "需要管理员权限" });

  const { results } = await env.DB.prepare(
    `SELECT users.id, users.username, users.role, users.status, users.created_at,
            users.last_login_at, COUNT(passkeys.id) AS passkey_count
       FROM users LEFT JOIN passkeys ON passkeys.user_id = users.id
      GROUP BY users.id
      ORDER BY CASE users.status WHEN 'pending' THEN 0 ELSE 1 END, users.created_at DESC`
  ).all();

  return jsonResponse(200, {
    users: results.map((item) => ({
      ...publicUser(item, item.passkey_count),
      lastLoginAt: item.last_login_at
    }))
  });
}

async function handleUpdateUser(request, env, targetUserId) {
  const user = await requireActiveUser(env, request);
  if (!user || user.role !== "admin") return jsonResponse(403, { message: "需要管理员权限" });

  const { status, role } = await readJson(request);
  if (!["pending", "active", "disabled"].includes(status) || !["admin", "user"].includes(role)) {
    return jsonResponse(400, { message: "用户状态或角色无效" });
  }
  if (targetUserId === user.id && (status !== "active" || role !== "admin")) {
    return jsonResponse(400, { message: "不能停用当前管理员或移除自己的管理员权限" });
  }

  const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(targetUserId).first();
  if (!target) return jsonResponse(404, { message: "未找到该用户" });

  await env.DB.batch([
    env.DB.prepare("UPDATE users SET status = ?, role = ?, updated_at = ? WHERE id = ?").bind(
      status,
      role,
      now(),
      targetUserId
    ),
    ...(status !== "active"
      ? [env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(targetUserId)]
      : [])
  ]);
  await writeAudit(env, request, "admin.user_update", user.id, targetUserId);

  return jsonResponse(200, { success: true });
}

function parseUpstreamRequest(rawConfig) {
  const config = JSON.parse(rawConfig ?? "");
  if (!config.url || !config.token || !config.body) throw new Error("UPSTREAM_REQUEST is incomplete");
  return config;
}

async function handleGatewayHealth(request, env) {
  const user = await requireActiveUser(env, request);
  if (!user || user.role !== "admin") return jsonResponse(403, { message: "需要管理员权限" });

  try {
    return jsonResponse(200, { gateway: await requestGatewayHealth(env) });
  } catch (error) {
    return jsonResponse(502, {
      message: error?.name === "AbortError" ? "网关健康检查超时" : "无法连接门禁网关"
    });
  }
}

function isGatewayAuthorized(request, env) {
  const provided = request.headers.get("authorization") ?? "";
  return Boolean(env.GATEWAY_SHARED_SECRET) && constantTimeEqual(
    provided,
    `Bearer ${env.GATEWAY_SHARED_SECRET}`
  );
}

async function handleGatewayPull(request, env) {
  if (!isGatewayAuthorized(request, env)) return jsonResponse(401, { message: "网关认证失败" });

  const currentTime = now();
  const command = await env.DB.prepare(
    `SELECT id, action FROM gateway_commands
      WHERE status = 'pending' AND expires_at > ?
      ORDER BY created_at ASC LIMIT 1`
  )
    .bind(currentTime)
    .first();
  if (!command) return jsonResponse(200, { command: null });

  const claim = await env.DB.prepare(
    `UPDATE gateway_commands SET status = 'processing', claimed_at = ?
      WHERE id = ? AND status = 'pending'`
  )
    .bind(currentTime, command.id)
    .run();
  if (!claim.meta.changes) return jsonResponse(200, { command: null });

  return jsonResponse(200, { command });
}

async function handleGatewayResult(request, env) {
  if (!isGatewayAuthorized(request, env)) return jsonResponse(401, { message: "网关认证失败" });

  const { id, success, status, result, code, message } = await readJson(request);
  if (!id || typeof success !== "boolean") return jsonResponse(400, { message: "网关结果无效" });

  const responseBody = {
    success,
    status,
    result,
    code,
    message: String(message ?? (success ? "操作成功" : "开门请求失败")).slice(0, 300)
  };
  const update = await env.DB.prepare(
    `UPDATE gateway_commands
        SET status = ?, response_json = ?, completed_at = ?
      WHERE id = ? AND status = 'processing'`
  )
    .bind(success ? "succeeded" : "failed", JSON.stringify(responseBody), now(), id)
    .run();

  if (!update.meta.changes) return jsonResponse(409, { message: "命令不存在或已完成" });
  return jsonResponse(200, { success: true });
}

async function enqueueGatewayCommand(env, user) {
  const id = crypto.randomUUID();
  const createdAt = now();
  await env.DB.prepare(
    `INSERT INTO gateway_commands (id, user_id, action, status, created_at, expires_at)
     VALUES (?, ?, 'open-door', 'pending', ?, ?)`
  )
    .bind(id, user.id, createdAt, createdAt + 30)
    .run();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const command = await env.DB.prepare(
      "SELECT status, response_json FROM gateway_commands WHERE id = ?"
    )
      .bind(id)
      .first();
    if (command?.status === "succeeded" || command?.status === "failed") {
      return JSON.parse(command.response_json);
    }
  }

  await env.DB.prepare(
    "UPDATE gateway_commands SET status = 'failed', response_json = ?, completed_at = ? WHERE id = ? AND status = 'pending'"
  )
    .bind(JSON.stringify({ success: false, message: "门禁网关未领取命令" }), now(), id)
    .run();
  return { success: false, message: "门禁网关响应超时" };
}

async function handleOpenDoor(request, env) {
  const user = await requireActiveUser(env, request);
  if (!user) return jsonResponse(401, { success: false, message: "请先登录" });
  if (request.headers.get("x-door-action") !== "open") {
    return jsonResponse(403, { success: false, message: "请求来源无效" });
  }

  if (env.GATEWAY_MODE === "pull" && env.GATEWAY_SHARED_SECRET) {
    const result = await enqueueGatewayCommand(env, user);
    await writeAudit(env, request, "door.open.gateway_pull", user.id, user.id);
    return jsonResponse(result.success ? 200 : 502, result);
  }

  if (env.GATEWAY_URL || env.GATEWAY_SHARED_SECRET) {
    try {
      const gateway = await requestGatewayOpenDoor(env);
      await writeAudit(env, request, "door.open.gateway", user.id, user.id);
      return jsonResponse(gateway.ok ? 200 : 502, {
        success: Boolean(gateway.data?.success),
        status: gateway.data?.status,
        result: gateway.data?.result,
        code: gateway.data?.code,
        message: gateway.data?.message ?? "网关开门请求失败"
      });
    } catch (error) {
      return jsonResponse(502, {
        success: false,
        message: error?.name === "AbortError" ? "门禁网关响应超时" : "无法连接门禁网关"
      });
    }
  }

  let upstreamRequest;
  try {
    upstreamRequest = parseUpstreamRequest(env.UPSTREAM_REQUEST);
  } catch {
    return jsonResponse(503, { success: false, message: "门锁服务尚未配置" });
  }

  const upstreamUrl = new URL(upstreamRequest.url);
  upstreamUrl.searchParams.set("token", upstreamRequest.token);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 15_000);

  try {
    const requestOptions = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        token: upstreamRequest.token,
        ...(upstreamRequest.userAgent && { "user-agent": upstreamRequest.userAgent }),
        ...(upstreamRequest.referer && { referer: upstreamRequest.referer })
      },
      body: JSON.stringify(upstreamRequest.body),
      signal: abortController.signal
    };
    const upstream = await fetch(upstreamUrl, requestOptions);
    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text || "接口返回了无法识别的内容" };
    }

    await writeAudit(env, request, "door.open", user.id, user.id);
    return jsonResponse(upstream.ok ? 200 : 502, {
      success: upstream.ok && data?.status === "1",
      status: data?.status,
      result: data?.result,
      code: data?.code,
      message: data?.message ?? "开门请求失败"
    });
  } catch (error) {
    return jsonResponse(502, {
      success: false,
      message: error?.name === "AbortError" ? "门锁响应超时，请稍后重试" : "无法连接门锁服务"
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const mutation = method !== "GET" && method !== "HEAD";

  if (path === "/api/gateway/pull" && method === "POST") return handleGatewayPull(request, env);
  if (path === "/api/gateway/result" && method === "POST") return handleGatewayResult(request, env);

  if (mutation && !isTrustedMutation(request)) {
    return jsonResponse(403, { message: "请求来源无效" });
  }

  if (path === "/api/auth/register" && method === "POST") return handleRegister(request, env);
  if (path === "/api/auth/login" && method === "POST") return handlePasswordLogin(request, env);
  if (path === "/api/auth/password" && method === "POST") return handlePasswordChange(request, env);
  if (path === "/api/auth/logout" && method === "POST") return handleLogout(request, env);
  if (path === "/api/auth/me" && method === "GET") return handleMe(request, env);
  if (path === "/api/passkeys/register/options" && method === "POST") {
    return handlePasskeyRegistrationOptions(request, env);
  }
  if (path === "/api/passkeys/register/verify" && method === "POST") {
    return handlePasskeyRegistrationVerify(request, env);
  }
  if (path === "/api/passkeys/login/options" && method === "POST") {
    return handlePasskeyAuthenticationOptions(request, env);
  }
  if (path === "/api/passkeys/login/verify" && method === "POST") {
    return handlePasskeyAuthenticationVerify(request, env);
  }
  if (path === "/api/passkeys" && method === "GET") return handleListPasskeys(request, env);
  if (path.startsWith("/api/passkeys/") && method === "DELETE") {
    return handleDeletePasskey(request, env, decodeURIComponent(path.slice("/api/passkeys/".length)));
  }
  if (path === "/api/admin/users" && method === "GET") return handleListUsers(request, env);
  if (path.startsWith("/api/admin/users/") && method === "PATCH") {
    return handleUpdateUser(request, env, decodeURIComponent(path.slice("/api/admin/users/".length)));
  }
  if (path === "/api/admin/gateway" && method === "GET") return handleGatewayHealth(request, env);
  if (path === "/api/open-door" && method === "POST") return handleOpenDoor(request, env);

  return jsonResponse(404, { message: "接口不存在" });
}

export default {
  async fetch(request, env, context) {
    try {
      const url = new URL(request.url);

      if (url.pathname.startsWith("/api/")) {
        context.waitUntil(
          env.DB.batch([
            env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now()),
            env.DB.prepare("DELETE FROM webauthn_challenges WHERE expires_at <= ?").bind(now())
          ]).catch(() => undefined)
        );
        return await handleApi(request, env);
      }

      return withSecurityHeaders(await env.ASSETS.fetch(request));
    } catch (error) {
      console.error("Unhandled request error", error);
      return jsonResponse(500, { message: "服务器暂时不可用" });
    }
  }
};
