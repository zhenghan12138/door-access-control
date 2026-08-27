const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'none'",
    "connect-src 'self'",
    "font-src 'self' https://fonts.gstatic.com",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "img-src 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com"
  ].join("; "),
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function textResponse(status, body, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      ...extraHeaders
    }
  });
}

function constantTimeEqual(left, right) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

function isAuthorized(request, env) {
  if (!env.ACCESS_USERNAME || !env.ACCESS_PASSWORD) return false;

  const expected = `Basic ${btoa(`${env.ACCESS_USERNAME}:${env.ACCESS_PASSWORD}`)}`;
  return constantTimeEqual(request.headers.get("authorization") ?? "", expected);
}

function hasValidRequestOrigin(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && origin !== url.origin) return false;
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  return request.headers.get("x-door-action") === "open";
}

function parseUpstreamRequest(rawConfig) {
  const config = JSON.parse(rawConfig ?? "");

  if (!config.url || !config.token || !config.body) {
    throw new Error("UPSTREAM_REQUEST is incomplete");
  }

  return config;
}

async function openDoor(request, env) {
  if (!hasValidRequestOrigin(request)) {
    return jsonResponse(403, { success: false, message: "请求来源无效" });
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
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        token: upstreamRequest.token,
        ...(upstreamRequest.userAgent && { "user-agent": upstreamRequest.userAgent }),
        ...(upstreamRequest.referer && { referer: upstreamRequest.referer })
      },
      body: JSON.stringify(upstreamRequest.body),
      signal: abortController.signal
    });
    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text || "接口返回了无法识别的内容" };
    }

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

function withSecurityHeaders(response) {
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

export default {
  async fetch(request, env) {
    if (!env.ACCESS_USERNAME || !env.ACCESS_PASSWORD) {
      return textResponse(503, "Access control is not configured");
    }

    if (!isAuthorized(request, env)) {
      return textResponse(401, "Authentication required", {
        "www-authenticate": 'Basic realm="Door Access", charset="UTF-8"'
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/open-door") {
      if (request.method !== "POST") {
        return textResponse(405, "Method Not Allowed", { allow: "POST" });
      }

      return openDoor(request, env);
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};

