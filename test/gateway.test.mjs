import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { ReplayCache, createGatewaySignature, verifyGatewayRequest } from "../gateway/auth.mjs";
import { createGatewayServer } from "../gateway/server.mjs";
import { createGatewayHeaders, resolveGatewayEndpoint } from "../worker/gateway-client.js";

const sharedSecret = "test-shared-secret-with-more-than-32-characters";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

test("worker signatures are accepted once and rejected on replay", async () => {
  const body = JSON.stringify({ action: "open-door" });
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const headers = new Headers(await createGatewayHeaders(sharedSecret, body, timestamp, nonce));
  const replayCache = new ReplayCache();

  assert.equal(verifyGatewayRequest(headers, body, sharedSecret, replayCache).valid, true);
  assert.deepEqual(verifyGatewayRequest(headers, body, sharedSecret, replayCache), {
    valid: false,
    reason: "请求已处理"
  });
});

test("rejects expired and invalid gateway signatures", () => {
  const body = JSON.stringify({ action: "open-door" });
  const nonce = crypto.randomUUID();
  const timestamp = String(Date.now() - 120_000);
  const headers = new Headers({
    "x-gateway-timestamp": timestamp,
    "x-gateway-nonce": nonce,
    "x-gateway-signature": createGatewaySignature(sharedSecret, timestamp, nonce, body)
  });

  assert.equal(verifyGatewayRequest(headers, body, sharedSecret, new ReplayCache()).valid, false);
  headers.set("x-gateway-timestamp", String(Date.now()));
  assert.equal(verifyGatewayRequest(headers, body, sharedSecret, new ReplayCache()).valid, false);
});

test("requires explicit opt-in for a public HTTP gateway", () => {
  const base = {
    GATEWAY_URL: "http://203.0.113.10:8788",
    GATEWAY_SHARED_SECRET: sharedSecret
  };

  assert.throws(() => resolveGatewayEndpoint(base), /显式启用/);
  assert.equal(
    resolveGatewayEndpoint({ ...base, ALLOW_INSECURE_GATEWAY: "true" }).toString(),
    "http://203.0.113.10:8788/v1/open-door"
  );
});

test("gateway verifies a signed command and forwards the door request", async (context) => {
  const upstream = createServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.headers.token, "upstream-token");
    let body = "";
    for await (const chunk of request) body += chunk;
    assert.deepEqual(JSON.parse(body), { door: "front" });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "1", message: "ok" }));
  });
  const upstreamUrl = await listen(upstream);
  const gateway = createGatewayServer({
    GATEWAY_SHARED_SECRET: sharedSecret,
    UPSTREAM_REQUEST_BASE64: Buffer.from(
      JSON.stringify({
        url: `${upstreamUrl}/open`,
        token: "upstream-token",
        body: { door: "front" }
      })
    ).toString("base64")
  });
  const gatewayUrl = await listen(gateway);
  context.after(async () => {
    await close(gateway);
    await close(upstream);
  });

  const health = await fetch(`${gatewayUrl}/health`);
  assert.equal(health.status, 200);

  const body = JSON.stringify({ action: "open-door" });
  const response = await fetch(`${gatewayUrl}/v1/open-door`, {
    method: "POST",
    headers: await createGatewayHeaders(sharedSecret, body),
    body
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.message, "ok");
});
