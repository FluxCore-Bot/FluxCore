import type { FastifySchema } from "fastify";

export interface DocsOptions {
  /** Module tag, e.g. "Welcome". Also used to group routes in Swagger UI. */
  tag: string;
  /** Attach the session-cookie security requirement. Default: true. */
  secure?: boolean;
  /** Success response schemas keyed by status code, e.g. `{ 200: { ... } }`. */
  response?: Record<string, unknown>;
}

/**
 * Inline error-response schema shared by all routes. Inlined (rather than a
 * `$ref`) so route schemas stay self-contained and resolve even in test apps
 * that do not register the shared component schemas.
 *
 * `additionalProperties: true` keeps it serialization-safe: Fastify still
 * serializes responses using these schemas, so anything extra the handler
 * sends (e.g. `details`, `required`) is preserved instead of stripped.
 */
export const ErrorResponseInline = {
  type: "object",
  properties: {
    error: { type: "string" },
    errorKey: { type: "string" },
    required: { type: "string" },
    details: { type: "object", additionalProperties: true },
  },
  additionalProperties: true,
} as const;

/**
 * Build a route `schema` with the standard documentation metadata:
 * module tag, optional session-cookie security, and the common error
 * responses (400/401/403/404/500).
 *
 * The base object may contain `body`, `params`, `querystring`, etc.
 */
export function withDocs(
  base: Record<string, unknown> | undefined,
  opts: DocsOptions,
): FastifySchema {
  const secure = opts.secure !== false;
  const schema: Record<string, unknown> = {
    ...(base ?? {}),
    tags: [opts.tag],
  };

  if (secure) {
    schema.security = [{ sessionCookie: [] }];
  }

  schema.response = {
    ...(opts.response ?? {}),
    400: ErrorResponseInline,
    401: ErrorResponseInline,
    403: ErrorResponseInline,
    404: ErrorResponseInline,
    500: ErrorResponseInline,
  };

  return schema as FastifySchema;
}
