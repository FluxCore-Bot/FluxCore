import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@fluxcore/config";

/**
 * Signing for the `oauth_state` cookie.
 *
 * This cookie deliberately does NOT use `@fastify/cookie`'s `signed: true`.
 * That signer keys on `config.dashboardSessionSecret` — the same key that
 * signs the `session` cookie — and it signs only the cookie *value*, never
 * its name. `GET /auth/login` is public and unauthenticated, so anyone could
 * request it, take the returned `oauth_state` value, and replay it as
 * `Cookie: session=<value>`. `request.unsignCookie` would report it valid,
 * and every consumer that treats "unsigns with the session secret" as "was
 * issued as a session" would believe it — including the rate limiter's key
 * generator, which would hand out an unlimited supply of fresh buckets.
 *
 * Signing state with its own key closes that: an `oauth_state` value no
 * longer verifies as a session cookie, and a session id no longer verifies
 * as state. The key is derived from the session secret via a
 * domain-separated HMAC, so no new configuration or secret is needed, and
 * the session cookie's own signing is untouched (changing it would log every
 * current user out).
 */

/** Domain-separation label. Changing it invalidates all in-flight logins. */
const OAUTH_STATE_LABEL = "oauth_state";

/** Splits `<state>.<mac>`. `state` is hex, so it never contains a dot. */
const SEPARATOR = ".";

/**
 * HMAC(sessionSecret, "oauth_state") — a key that is computationally
 * independent of the session secret, so recovering one does not yield the
 * other and neither cookie's signature validates under the other's key.
 */
function stateSigningKey(): Buffer {
  return createHmac("sha256", config.dashboardSessionSecret)
    .update(OAUTH_STATE_LABEL)
    .digest();
}

function macFor(state: string): string {
  return createHmac("sha256", stateSigningKey()).update(state).digest("base64url");
}

/** Length-safe constant-time string comparison. */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, and the lengths here are not
  // secret (both sides are fixed-width hex/base64url when untampered).
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Produce the cookie value for a freshly generated OAuth `state`. */
export function signOAuthState(state: string): string {
  return `${state}${SEPARATOR}${macFor(state)}`;
}

/**
 * True when `cookieValue` is a state this server signed AND it matches the
 * `state` query parameter Discord echoed back. Both comparisons are
 * constant-time.
 */
export function verifyOAuthState(cookieValue: string, expectedState: string): boolean {
  const separatorIndex = cookieValue.lastIndexOf(SEPARATOR);
  if (separatorIndex <= 0) return false;

  const state = cookieValue.slice(0, separatorIndex);
  const mac = cookieValue.slice(separatorIndex + 1);

  if (!constantTimeEquals(mac, macFor(state))) return false;
  return constantTimeEquals(state, expectedState);
}
