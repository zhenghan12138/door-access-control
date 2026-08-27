import assert from "node:assert/strict";
import test from "node:test";

import worker from "../worker/index.js";

const username = "door-admin";
const password = "test-password";
const authorization = `Basic ${btoa(`${username}:${password}`)}`;
const upstreamRequest = JSON.stringify({
  url: "https://upstream.example/open",
  token: "upstream-token",
  body: { door: "front" }
});

function createEnv(overrides = {}) {
  return {
    ACCESS_USERNAME: username,
    ACCESS_PASSWORD: password,
    UPSTREAM_REQUEST: upstreamRequest,
    ASSETS: {
      fetch: async () => new Response("asset", { headers: { "content-type": "text/html" } })
    },
    ...overrides
  };
}

test("rejects requests without credentials", async () => {
  const response = await worker.fetch(new Request("https://door.example/"), createEnv());

  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate"), /^Basic /);
});

test("serves protected static assets with security headers", async () => {
  const response = await worker.fetch(
    new Request("https://door.example/", { headers: { authorization } }),
    createEnv()
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("rejects cross-origin door requests", async () => {
  const response = await worker.fetch(
    new Request("https://door.example/api/open-door", {
      method: "POST",
      headers: {
        authorization,
        origin: "https://attacker.example",
        "x-door-action": "open"
      }
    }),
    createEnv()
  );

  assert.equal(response.status, 403);
});

test("forwards a valid door request without exposing credentials", async (context) => {
  const originalFetch = globalThis.fetch;

  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, options) => {
    assert.equal(url.searchParams.get("token"), "upstream-token");
    assert.equal(options.headers.token, "upstream-token");
    assert.deepEqual(JSON.parse(options.body), { door: "front" });
    return new Response(JSON.stringify({ status: "1", message: "ok" }));
  };

  const response = await worker.fetch(
    new Request("https://door.example/api/open-door", {
      method: "POST",
      headers: {
        authorization,
        origin: "https://door.example",
        "sec-fetch-site": "same-origin",
        "x-door-action": "open"
      }
    }),
    createEnv()
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(JSON.stringify(body).includes("upstream-token"), false);
});

