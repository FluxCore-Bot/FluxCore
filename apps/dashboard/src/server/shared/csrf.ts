import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TOKEN_BYTES = 32;
const MIN_TOKEN_LENGTH = TOKEN_BYTES * 2; // hex

export function generateCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export async function requireCsrf(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (SAFE_METHODS.has(request.method)) return;

  const cookieToken = request.cookies?.csrf_token;
  const headerToken = request.headers["x-csrf-token"];
  const headerStr = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  if (
    !cookieToken ||
    !headerStr ||
    cookieToken.length < MIN_TOKEN_LENGTH ||
    headerStr.length < MIN_TOKEN_LENGTH ||
    !safeEqual(cookieToken, headerStr)
  ) {
    reply.code(403).send({
      error: "CSRF token missing or invalid",
      errorKey: "errors:csrf.invalid",
    });
    return;
  }
}
