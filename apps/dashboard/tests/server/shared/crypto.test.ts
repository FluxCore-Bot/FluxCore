import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { dashboardSessionSecret: "test-secret-do-not-use-in-prod-1234567890" },
}));

const { encrypt, decrypt, isEncrypted } = await import(
  "../../../src/server/shared/crypto.js"
);

describe("crypto helpers", () => {
  it("encrypt -> decrypt round-trips", () => {
    const plaintext = "discord_oauth_access_token_value";
    const encoded = encrypt(plaintext);
    expect(encoded).not.toBe(plaintext);
    expect(decrypt(encoded)).toBe(plaintext);
  });

  it("isEncrypted returns true for output of encrypt()", () => {
    expect(isEncrypted(encrypt("hello"))).toBe(true);
  });

  it("isEncrypted returns false for arbitrary plaintext", () => {
    expect(isEncrypted("plain-bearer-token")).toBe(false);
    expect(isEncrypted("")).toBe(false);
    expect(isEncrypted("not-base64!!!")).toBe(false);
  });

  it("decrypt throws on tampered ciphertext", () => {
    const enc = encrypt("payload");
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(() => decrypt(tampered)).toThrow();
  });
});
