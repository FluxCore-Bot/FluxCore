import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import {
  generateCsrfToken,
  requireCsrf,
} from "../../../src/server/shared/csrf.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "x".repeat(64) });
  app.get("/issue", async (_req, reply) => {
    const token = generateCsrfToken();
    reply
      .setCookie("csrf_token", token, { path: "/", sameSite: "lax" })
      .send({ token });
  });
  app.post("/safe", { preHandler: requireCsrf }, async () => ({ ok: true }));
  return app;
}

describe("CSRF double-submit", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("rejects POST without csrf cookie", async () => {
    const res = await app.inject({ method: "POST", url: "/safe" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("rejects POST with mismatched token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/safe",
      cookies: { csrf_token: "abc" },
      headers: { "x-csrf-token": "xyz" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("accepts POST with matching token", async () => {
    const issue = await app.inject({ method: "GET", url: "/issue" });
    const body = issue.json() as { token: string };
    const res = await app.inject({
      method: "POST",
      url: "/safe",
      cookies: { csrf_token: body.token },
      headers: { "x-csrf-token": body.token },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("rejects when token is short (likely empty)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/safe",
      cookies: { csrf_token: "" },
      headers: { "x-csrf-token": "" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
