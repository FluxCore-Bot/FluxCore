import { describe, it, expect, vi } from "vitest";

// Hoisted so the (also hoisted) vi.mock factory below can reference it.
const { SESSION_SECRET } = vi.hoisted(() => ({ SESSION_SECRET: "x".repeat(64) }));

vi.mock("@fluxcore/config", () => ({
  config: { dashboardSessionSecret: SESSION_SECRET },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import {
  signOAuthState,
  verifyOAuthState,
} from "../../../../src/server/features/auth/oauthState.js";

const STATE = "a".repeat(64);
const OTHER_STATE = "b".repeat(64);

describe("signOAuthState / verifyOAuthState", () => {
  it("verifies a value it produced against the matching state", () => {
    expect(verifyOAuthState(signOAuthState(STATE), STATE)).toBe(true);
  });

  it("rejects a value whose state does not match the query parameter", () => {
    expect(verifyOAuthState(signOAuthState(STATE), OTHER_STATE)).toBe(false);
  });

  it("rejects a tampered state carrying a signature minted for another state", () => {
    const signed = signOAuthState(STATE);
    const mac = signed.slice(signed.lastIndexOf(".") + 1);
    expect(verifyOAuthState(`${OTHER_STATE}.${mac}`, OTHER_STATE)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const signed = signOAuthState(STATE);
    const mac = signed.slice(signed.lastIndexOf(".") + 1);
    const flipped = (mac[0] === "A" ? "B" : "A") + mac.slice(1);
    expect(verifyOAuthState(`${STATE}.${flipped}`, STATE)).toBe(false);
  });

  it("rejects an unsigned bare state", () => {
    expect(verifyOAuthState(STATE, STATE)).toBe(false);
  });

  it("rejects an empty value", () => {
    expect(verifyOAuthState("", "")).toBe(false);
  });

  // The whole point of the separate key: a state cookie must NOT be a valid
  // @fastify/cookie signature under the session secret, or /auth/login becomes
  // a public mint for "validly signed" session-cookie values.
  it("does not produce a value that unsigns with the session secret", async () => {
    const app = Fastify();
    await app.register(fastifyCookie, { secret: SESSION_SECRET });
    app.get("/probe", async (request) => ({
      valid: request.unsignCookie(request.cookies.probe ?? "").valid,
    }));
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/probe",
      cookies: { probe: signOAuthState(STATE) },
    });

    expect(res.json<{ valid: boolean }>().valid).toBe(false);
    await app.close();
  });

  // ...and the converse: a session-secret-signed value must not pass as state.
  it("does not accept a session-secret-signed value as state", async () => {
    const app = Fastify();
    await app.register(fastifyCookie, { secret: SESSION_SECRET });
    await app.ready();

    expect(verifyOAuthState(app.signCookie(STATE), STATE)).toBe(false);
    await app.close();
  });
});
