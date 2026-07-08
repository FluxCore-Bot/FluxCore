import type { FastifyHelmetOptions } from "@fastify/helmet";

/**
 * Helmet options for the dashboard.
 *
 * `enableCSPNonces: true` tells @fastify/helmet to generate a per-request nonce
 * and automatically append `'nonce-<value>'` to `script-src`/`style-src`. The
 * same nonce is exposed on the Fastify reply as `reply.cspNonce` for injecting
 * `<style nonce>` into the SPA index.html.
 *
 * Do NOT add manual `(req, reply) => reply.cspNonce...` directive functions:
 * helmet invokes CSP directive functions with `(request.raw, reply.raw)`, so the
 * second argument is the raw Node ServerResponse (which has no `cspNonce`).
 * Reading `.cspNonce.script` off it throws and turns every response into a 500.
 */
export const helmetOptions: FastifyHelmetOptions = {
  enableCSPNonces: true,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://cdn.discordapp.com"],
    },
  },
};
