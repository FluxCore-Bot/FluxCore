import type { FastifyInstance, FastifyRequest } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  initServerI18n,
  getTranslation,
  detectLanguage,
  localesPath,
} from "@fluxcore/i18n/server";
import { supportedLanguageCodes } from "@fluxcore/i18n";
import type { TFunction } from "i18next";

declare module "fastify" {
  interface FastifyRequest {
    t: TFunction;
    lng: string;
  }
}

/**
 * Initialize server-side i18n and register:
 * 1. A preHandler that attaches `t()` and `lng` to every request
 * 2. A public endpoint `GET /api/i18n/:lng/:ns` to serve translation files
 */
export async function registerI18n(app: FastifyInstance): Promise<void> {
  await initServerI18n();

  // Attach translation function to every request based on Accept-Language
  app.addHook("preHandler", async (request: FastifyRequest) => {
    const acceptLang = request.headers["accept-language"];
    request.lng = detectLanguage(acceptLang);
    request.t = getTranslation(request.lng);
  });

  // Serve translation files for the client
  app.get<{
    Params: { lng: string; ns: string };
  }>("/api/i18n/:lng/:ns", async (request, reply) => {
    const { lng, ns } = request.params;

    // Validate language and namespace
    if (!supportedLanguageCodes.includes(lng)) {
      reply.code(404).send({ error: "Unsupported language" });
      return;
    }

    const allowedNamespaces = [
      "common", "errors", "guilds", "overview", "logs", "music", "settings",
      "tempvoice", "moderation", "warnings", "rules", "welcome", "scheduled",
      "commands", "leveling", "roles", "security", "permissions", "tickets",
      "suggestions", "starboard", "giveaways", "landing",
    ];
    if (!allowedNamespaces.includes(ns)) {
      reply.code(404).send({ error: "Unknown namespace" });
      return;
    }

    const filePath = join(localesPath, lng, `${ns}.json`);

    try {
      const content = await readFile(filePath, "utf-8");
      reply
        .header("Content-Type", "application/json")
        .header("Cache-Control", "public, max-age=3600")
        .send(content);
    } catch {
      // Fall back to English if the requested language file doesn't exist
      try {
        const fallback = await readFile(
          join(localesPath, "en", `${ns}.json`),
          "utf-8",
        );
        reply
          .header("Content-Type", "application/json")
          .header("Cache-Control", "public, max-age=3600")
          .send(fallback);
      } catch {
        reply.code(404).send({ error: "Translation not found" });
      }
    }
  });
}
