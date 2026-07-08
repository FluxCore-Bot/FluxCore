import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import fastifyHelmet from "@fastify/helmet";
import { helmetOptions } from "../../../src/server/shared/security.js";

// Regression guard for the CSP-nonce 500: the previous config passed
// `(_req, reply) => reply.cspNonce.script` directive functions, but helmet
// invokes directive functions with (request.raw, reply.raw), so `reply` was the
// raw Node ServerResponse (no `cspNonce`). Reading `.script` off `undefined`
// threw and turned EVERY helmeted response into a 500 — /api/i18n/:lng/:ns was
// simply the first API the SPA hit on load, so it was the visible symptom.
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(fastifyHelmet, helmetOptions);
  // Stand-in for the real /api/i18n/:lng/:ns handler.
  app.get("/api/i18n/:lng/:ns", async (_req, reply) => {
    reply.header("Content-Type", "application/json").send('{"ok":true}');
  });
  // Stand-in for the SPA index.html injection path, which reads the nonce off
  // the *Fastify* reply (index.ts setNotFoundHandler) — must keep working.
  app.get("/spa", async (_req, reply) => {
    reply.type("text/html").send(`nonce=${reply.cspNonce.style}`);
  });
  return app;
}

describe("dashboard helmet CSP nonces", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves an API route with 200, not 500 (the i18n regression)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/i18n/en/common" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('{"ok":true}');
  });

  it("auto-appends a nonce to script-src and style-src", async () => {
    const res = await app.inject({ method: "GET", url: "/api/i18n/en/common" });
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toMatch(/script-src [^;]*'nonce-[a-f0-9]{32}'/);
    expect(csp).toMatch(/style-src [^;]*'nonce-[a-f0-9]{32}'/);
  });

  it("exposes reply.cspNonce to handlers, matching the header nonce", async () => {
    const res = await app.inject({ method: "GET", url: "/spa" });
    expect(res.statusCode).toBe(200);
    const bodyNonce = /nonce=([a-f0-9]{32})/.exec(res.body)?.[1];
    expect(bodyNonce).toBeTruthy();
    const csp = res.headers["content-security-policy"] as string;
    // The nonce injected into <style> must match the one advertised in the header.
    expect(csp).toContain(`style-src 'self' https://fonts.googleapis.com 'nonce-${bodyNonce}'`);
  });

  it("keeps CSP hardened (no unsafe-inline / unsafe-eval)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/i18n/en/common" });
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });
});
