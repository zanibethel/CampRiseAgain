import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as helper from "../lib/camp-auth-email.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/api/admin/request-sign-in-link/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const goodLink = "https://yufptpfiwdbzzrvhkvux.supabase.co/auth/v1/verify?" +
  "token=one-time-test-token&type=magiclink&redirect_to=" +
  encodeURIComponent("https://campriseagain.org/admin");

function loadRoute({ rateLimited = false, badLink = false, sendFailure = false, bridgeUnavailable = false, approved = true } = {}) {
  const sent = []; const bridges = [];
  class MockCampBridgeError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  const dependencies = {
    "@/lib/camp-supabase-bridge": {
      CampBridgeError: MockCampBridgeError,
      campBridge: async (action, params) => {
        bridges.push({ action, params });
        if (rateLimited) throw new MockCampBridgeError("Too many requests", 429);
        if (bridgeUnavailable) throw new MockCampBridgeError("Service unavailable", 503);
        return { approved, actionLink: badLink ? "https://evil.example/auth/v1/verify?token=x&type=magiclink" : goodLink };
      },
    },
    "resend": { Resend: class {
      constructor(key) {
        assert.equal(key, "resend-test-key");
        this.emails = { send: async data => {
          sent.push(data);
          return { error: sendFailure ? { name: "ProviderError" } : null };
        }};
      }
    }},
    "@/lib/camp-auth-email": helper,
  };
  const mod = { exports: {} };
  const mockRequire = name => dependencies[name] ?? require(name);
  new Function("require", "module", "exports", compiled)(mockRequire, mod, mod.exports);
  return { post: mod.exports.POST, sent, bridges };
}

function request(email = "matthias.quellenberg@gmail.com", origin = "https://campriseagain.org") {
  return new Request("https://campriseagain.org/api/admin/request-sign-in-link", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "x-vercel-forwarded-for": "203.0.113.2" },
    body: JSON.stringify({ email }),
  });
}

const env = {
  VERCEL_ENV: "production",
  CAMP_SUPABASE_BRIDGE_TOKEN: "test-bridge-token",
  CAMP_RESEND_API_KEY: "resend-test-key",
};
const original = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
for (const [key, value] of Object.entries(env)) process.env[key] = value;
test.after(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("Camp magic-link request sends via Support and never returns the one-time token", async () => {
  const r = loadRoute();
  const response = await r.post(request());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(r.sent.length, 1);
  assert.equal(r.sent[0].from, "Camp Rise Again Support <support@campriseagain.org>");
  assert.deepEqual(r.sent[0].to, ["matthias.quellenberg@gmail.com"]);
  assert.ok(r.sent[0].text.includes("This inbox is not monitored"));
  assert.ok(r.sent[0].html.includes(">Sign In to Camp Rise Again</a>"));
  assert.ok(r.sent[0].html.includes('href="' + goodLink.replaceAll("&", "&amp;") + '"'));
  assert.ok(!r.sent[0].html.includes(">" + goodLink + "<"));
  assert.ok(!JSON.stringify(body).includes("one-time-test-token"));
  assert.equal(r.bridges.length, 1);
  assert.equal(r.bridges[0].action, "generate_camp_signin_link");
  assert.match(r.bridges[0].params.ipFingerprint, /^[a-f0-9]{64}$/);
  assert.match(r.bridges[0].params.emailFingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(r.bridges[0].params.emailFingerprint, r.bridges[0].params.ipFingerprint);
});

test("both existing and newly added Camp admins are allowed", async () => {
  for (const email of [
    "schofieldtierra@gmail.com", "zanibethel@gmail.com",
    "matthias.quellenberg@gmail.com", "james.campriseagain@gmail.com",
  ]) {
    const r = loadRoute();
    const response = await r.post(request(email));
    assert.equal(response.status, 200);
    assert.equal(r.sent.length, 1);
  }
});

test("non-admin email produces a generic response without generating links", async () => {
  const r = loadRoute({approved:false});
  const response = await r.post(request("someone@example.org"));
  assert.equal(response.status, 200);
  assert.equal(r.sent.length, 0);
  assert.equal(r.bridges.length, 1);
  assert.equal((await response.json()).ok, true);
});

test("rejects cross-origin and preview sign-in requests", async () => {
  const r = loadRoute();
  assert.equal((await r.post(request(undefined, "https://attacker.example"))).status, 403);
  assert.equal(r.sent.length, 0);
  process.env.VERCEL_ENV = "preview";
  try {
    assert.equal((await r.post(request())).status, 503);
    assert.equal(r.bridges.length, 0);
  } finally {
    process.env.VERCEL_ENV = "production";
  }
});

test("rate limits, bridge errors, wrong redirect and Resend failures fail safely", async () => {
  for (const [options, expected] of [
    [{ rateLimited: true }, 429],
    [{ bridgeUnavailable: true }, 503],
    [{ badLink: true }, 503],
    [{ sendFailure: true }, 503],
  ]) {
    const r = loadRoute(options);
    assert.equal((await r.post(request())).status, expected);
    if (options.badLink || options.rateLimited || options.bridgeUnavailable) assert.equal(r.sent.length, 0);
  }
});

test("validates Supabase magic-link origin, redirect, token and email type", () => {
  assert.equal(helper.validCampSigninLink(goodLink), true);
  for (const bad of [
    goodLink.replace("magiclink", "recovery"),
    goodLink.replace("campriseagain.org", "attacker.example"),
    goodLink.replace("one-time-test-token", ""),
    goodLink.replace("supabase.co", "attacker.example"),
  ]) assert.equal(helper.validCampSigninLink(bad), false);
});

test("private bridge enforces admin allowlist, rate limits and fixed Camp redirect", () => {
  const bridge = readFileSync(new URL("../supabase/functions/camp-email-bridge/index.ts", import.meta.url), "utf8");
  const section = bridge.split('if (action === "generate_camp_signin_link")')[1]?.split('if (action === "ping")')[0];
  assert.ok(section);
  assert.match(section, /activeCampAdmin\(recipient\)/);
  assert.match(section, /SHA256\.test\(ipFingerprint\)/);
  assert.match(section, /SHA256\.test\(emailFingerprint\)/);
  assert.match(section, /camp_rise_again_claim_form_rate/g);
  assert.match(section, /type: "magiclink"/);
  assert.match(section, /redirectTo: "https:\/\/campriseagain\.org\/admin"/);
  assert.ok(bridge.indexOf("if (!(await authorized(request)))") < bridge.indexOf('if (action === "generate_camp_signin_link")'));
});

test("forwarding verification emails also use Camp Support and a short HTML link", () => {
  const source = readFileSync(new URL("../app/api/admin/email-forwarders/route.ts", import.meta.url), "utf8");
  assert.ok(source.includes('from: CAMP_AUTH_FROM'));
  assert.ok(source.includes("Confirm Email Forwarding</a>"));
  assert.ok(source.includes("This inbox is not monitored"));
  assert.ok(!source.includes('from: "Camp Rise Again <info@campriseagain.org>"'));
  assert.ok(source.includes("escapeHtml(name)"));
  assert.ok(source.includes("escapeHtml(title)"));
});
