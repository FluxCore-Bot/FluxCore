import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { getTranslation, detectLanguage } from "@fluxcore/i18n/server";

/**
 * The i18n key for the 429 message. Already present in all 48 locales.
 */
export const RATE_LIMITED_ERROR_KEY = "errors:server.rateLimited";

/**
 * English text of RATE_LIMITED_ERROR_KEY, used when i18n cannot answer.
 */
const RATE_LIMITED_FALLBACK = "Too many requests. Please try again later.";

/**
 * Only the field this module reads. Declaring it locally rather than importing
 * the plugin's context type keeps the signature independent of the plugin's
 * type-export shape; it stays assignable because a wider parameter type is
 * accepted contravariantly.
 */
interface RateLimitContext {
  after: string;
}

/**
 * Identify the client a rate limit bucket belongs to.
 *
 * Keyed on the session cookie because that is the only stable client identity
 * available at `onRequest`, which is when the limiter runs — `request.session`
 * is not populated until `requireAuth`, a route-level `preHandler`. Reading it
 * here would silently yield `undefined` for every request.
 *
 * Safe to call at `onRequest`: `@fastify/cookie` is registered before
 * `@fastify/rate-limit`, so `cookies` and `unsignCookie` are already available.
 *
 * Only signature-valid cookies produce a session key, so a client cannot mint
 * unlimited buckets by inventing cookie values. The value is hashed so raw
 * session ids never reach store keys or the plugin's `onExceeded` logging.
 */
export function rateLimitKey(request: FastifyRequest): string {
  const cookie = request.cookies?.session;
  if (cookie) {
    const unsigned = request.unsignCookie(cookie);
    if (unsigned.valid && unsigned.value) {
      const digest = createHash("sha256").update(unsigned.value).digest("base64url");
      return `s:${digest.slice(0, 22)}`;
    }
  }
  return `ip:${request.ip}`;
}

/**
 * Build the 429 body.
 *
 * Resolves its own translator instead of using `request.t`: i18n attaches `t`
 * in a `preHandler` while this runs at `onRequest`, so `request.t` is undefined
 * here and calling it would throw — turning a 429 into a 500. Translation
 * failures degrade to English rather than propagating, so the limiter can never
 * be the thing that breaks a request.
 */
export function rateLimitErrorResponse(
  request: FastifyRequest,
  context: RateLimitContext,
): object {
  let message = RATE_LIMITED_FALLBACK;
  try {
    const t = getTranslation(detectLanguage(request.headers["accept-language"]));
    const translated = t(RATE_LIMITED_ERROR_KEY);
    // i18next echoes the key back when the namespace is not loaded.
    if (translated && translated !== RATE_LIMITED_ERROR_KEY) {
      message = translated;
    }
  } catch {
    // i18n not initialized yet (early startup, tests) — keep the fallback.
  }

  return {
    statusCode: 429,
    error: message,
    errorKey: RATE_LIMITED_ERROR_KEY,
    retryAfter: context.after,
  };
}

/**
 * Named tiers for expensive routes. Spread into a route's `config`:
 *
 *     app.post("/path", { config: rateLimits.heavy, ... })
 *
 * Values are per session, per minute. `heavy` sits above the ~25/min a slider
 * drag in the image editor produces, so ordinary editing never trips it.
 *
 * Routes without a tier fall back to `globalRateLimitOptions`. Every tier
 * inherits the shared key generator and error builder via the plugin's
 * route/global config merge.
 */
export const rateLimits = {
  /** CPU- or network-expensive rendering and preview work. */
  heavy: { rateLimit: { max: 40, timeWindow: "1 minute" } },
  /** Large request bodies written to storage. */
  upload: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  /** Cache-busting fanout to the Discord API. */
  external: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  /** Resource creation. */
  create: { rateLimit: { max: 10, timeWindow: "1 minute" } },
} as const;

/**
 * Options for the single global plugin registration. Setting the key generator
 * and error builder here is enough for every route: the plugin merges route
 * config over these globals, so routes that do not override them inherit them.
 */
export const globalRateLimitOptions = {
  max: 300,
  timeWindow: "1 minute",
  keyGenerator: rateLimitKey,
  errorResponseBuilder: rateLimitErrorResponse,
};
