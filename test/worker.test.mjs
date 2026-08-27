import assert from "node:assert/strict";
import test from "node:test";

import worker from "../worker/index.js";
import {
  getCookie,
  hashPassword,
  isTrustedMutation,
  sessionCookie,
  toBase64Url,
  validatePassword,
  validateUsername,
  verifyPassword
} from "../worker/lib.js";
import {
  decryptProxyPassword,
  encryptProxyPassword,
  validateProxyInput
} from "../worker/proxy-config.js";

function mockDatabase() {
  const statement = {
    bind() {
      return statement;
    },
    async run() {
      return { meta: { changes: 0 } };
    }
  };

  return {
    prepare() {
      return statement;
    },
    async batch() {
      return [];
    }
  };
}

function mockContext() {
  return {
    waitUntil(promise) {
      void promise;
    }
  };
}

test("hashes and verifies passwords without retaining plaintext", async () => {
  const password = "a-secure-password";
  const encoded = await hashPassword(password, 1_000);

  assert.match(encoded, /^pbkdf2_sha256\$1000\$/);
  assert.equal(encoded.includes(password), false);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword("wrong-password", encoded), false);
});

test("validates account credentials", () => {
  assert.equal(validateUsername("door-admin"), true);
  assert.equal(validateUsername("门禁管理员"), true);
  assert.equal(validateUsername("ab"), false);
  assert.equal(validateUsername("bad name"), false);
  assert.equal(validatePassword("1234567890"), true);
  assert.equal(validatePassword("short"), false);
});

test("validates proxy settings and encrypts proxy passwords", async () => {
  const proxy = validateProxyInput({
    enabled: true,
    host: "proxy.example.com",
    port: 1080,
    username: "door-user",
    password: "proxy-password"
  });
  const secret = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const encrypted = await encryptProxyPassword(proxy.password, secret);

  assert.equal(proxy.enabled, true);
  assert.equal(encrypted.includes(proxy.password), false);
  assert.equal(await decryptProxyPassword(encrypted, secret), proxy.password);
  assert.throws(() => validateProxyInput({ host: "bad host", port: 1080 }), /主机地址/);
  assert.throws(() => validateProxyInput({ host: "proxy.example.com", port: 70000 }), /端口/);
  assert.throws(
    () =>
      validateProxyInput(
        { host: "proxy.example.com", port: 1080, username: "door-user" },
        { passwordRequired: true }
      ),
    /代理密码/
  );
});

test("sets and parses strict session cookies", () => {
  const cookie = sessionCookie("secret-token");
  const request = new Request("https://door.example/", { headers: { cookie } });

  assert.equal(getCookie(request, "door_session"), "secret-token");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
});

test("only trusts same-origin mutations with the application header", () => {
  const trusted = new Request("https://door.example/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://door.example",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "door-access"
    }
  });
  const crossOrigin = new Request("https://door.example/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
      "x-requested-with": "door-access"
    }
  });

  assert.equal(isTrustedMutation(trusted), true);
  assert.equal(isTrustedMutation(crossOrigin), false);
});

test("serves the login application publicly with security headers", async () => {
  const response = await worker.fetch(
    new Request("https://door.example/"),
    {
      DB: mockDatabase(),
      ASSETS: { fetch: async () => new Response("login application") }
    },
    mockContext()
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "login application");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
});

test("rejects cross-origin API mutations before handling account data", async () => {
  const response = await worker.fetch(
    new Request("https://door.example/api/auth/register", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "x-requested-with": "door-access"
      }
    }),
    { DB: mockDatabase() },
    mockContext()
  );

  assert.equal(response.status, 403);
});
