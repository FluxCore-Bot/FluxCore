import type { FastifyInstance } from "fastify";
import { withDocs } from "../../shared/openapi-schemas.js";
import { randomUUID } from "node:crypto";
import { requireAuth, requireGuildAdmin, requirePermission } from "../../shared/middleware.js";
import { getWelcomeConfig, upsertWelcomeConfig } from "@fluxcore/systems/welcome/config";
import {
  generateWelcomeImage,
  getAllTemplates,
  getAvailableFonts,
  createStorageAdapter,
  welcomeImageSettingsSchema,
  DEFAULT_WELCOME_IMAGE_SETTINGS,
  DEFAULT_FAREWELL_IMAGE_SETTINGS,
  MAX_BACKGROUND_SIZE,
  ALLOWED_BACKGROUND_TYPES,
  PRESET_BACKGROUNDS,
} from "@fluxcore/systems/welcome/image";

const storage = createStorageAdapter();

export function registerWelcomeRoutes(app: FastifyInstance): void {
  // GET full welcome config
  app.get(
    "/api/guilds/:guildId/welcome",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.view")],
      schema: withDocs({ params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } }, { tag: "Welcome", response: { 200: { type: "object", additionalProperties: true } } }),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const config = await getWelcomeConfig(guildId);
      reply.send(config ?? {
        guildId,
        welcomeEnabled: false,
        welcomeChannelId: null,
        welcomeMessage: {},
        farewellEnabled: false,
        farewellChannelId: null,
        farewellMessage: {},
        dmEnabled: false,
        dmMessage: {},
        autoRoleIds: [],
        welcomeImageEnabled: false,
        welcomeImageConfig: DEFAULT_WELCOME_IMAGE_SETTINGS,
        farewellImageEnabled: false,
        farewellImageConfig: DEFAULT_FAREWELL_IMAGE_SETTINGS,
      });
    },
  );

  // PUT update welcome config
  app.put(
    "/api/guilds/:guildId/welcome",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            properties: {
              welcomeEnabled: { type: "boolean" },
              welcomeChannelId: { type: ["string", "null"] },
              welcomeMessage: { type: "object", additionalProperties: true },
              farewellEnabled: { type: "boolean" },
              farewellChannelId: { type: ["string", "null"] },
              farewellMessage: { type: "object", additionalProperties: true },
              dmEnabled: { type: "boolean" },
              dmMessage: { type: "object", additionalProperties: true },
              autoRoleIds: { type: "array", items: { type: "string" } },
              welcomeImageEnabled: { type: "boolean" },
              welcomeImageConfig: { type: "object", additionalProperties: true },
              farewellImageEnabled: { type: "boolean" },
              farewellImageConfig: { type: "object", additionalProperties: true },
            },
            additionalProperties: false,
          },
        },
        {
          tag: "Welcome",
          response: {
            200: {
              type: "object",
              properties: {
                guildId: { type: "string" },
                welcomeEnabled: { type: "boolean" },
                welcomeChannelId: { type: ["string", "null"] },
                welcomeMessage: { type: "object", additionalProperties: true },
                farewellEnabled: { type: "boolean" },
                farewellChannelId: { type: ["string", "null"] },
                farewellMessage: { type: "object", additionalProperties: true },
                dmEnabled: { type: "boolean" },
                dmMessage: { type: "object", additionalProperties: true },
                autoRoleIds: { type: "array", items: { type: "string" } },
                welcomeImageEnabled: { type: "boolean" },
                welcomeImageConfig: { type: "object", additionalProperties: true },
                farewellImageEnabled: { type: "boolean" },
                farewellImageConfig: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;

      const update: Record<string, unknown> = {};
      if (body.welcomeEnabled !== undefined) update.welcomeEnabled = body.welcomeEnabled;
      if (body.welcomeChannelId !== undefined) update.welcomeChannelId = body.welcomeChannelId;
      if (body.welcomeMessage !== undefined) update.welcomeMessage = body.welcomeMessage;
      if (body.farewellEnabled !== undefined) update.farewellEnabled = body.farewellEnabled;
      if (body.farewellChannelId !== undefined) update.farewellChannelId = body.farewellChannelId;
      if (body.farewellMessage !== undefined) update.farewellMessage = body.farewellMessage;
      if (body.dmEnabled !== undefined) update.dmEnabled = body.dmEnabled;
      if (body.dmMessage !== undefined) update.dmMessage = body.dmMessage;
      if (body.autoRoleIds !== undefined) update.autoRoleIds = body.autoRoleIds;

      // Validate image settings with Zod before saving
      if (body.welcomeImageEnabled !== undefined) update.welcomeImageEnabled = body.welcomeImageEnabled;
      if (body.welcomeImageConfig !== undefined) {
        const parsed = welcomeImageSettingsSchema.safeParse(body.welcomeImageConfig);
        if (!parsed.success) {
          reply.code(400).send({ error: "Invalid welcome image config", details: parsed.error.flatten() });
          return;
        }
        update.welcomeImageConfig = parsed.data;
      }
      if (body.farewellImageEnabled !== undefined) update.farewellImageEnabled = body.farewellImageEnabled;
      if (body.farewellImageConfig !== undefined) {
        const parsed = welcomeImageSettingsSchema.safeParse(body.farewellImageConfig);
        if (!parsed.success) {
          reply.code(400).send({ error: "Invalid farewell image config", details: parsed.error.flatten() });
          return;
        }
        update.farewellImageConfig = parsed.data;
      }

      const config = await upsertWelcomeConfig(guildId, update);
      reply.send(config);
    },
  );

  // POST test welcome message
  app.post(
    "/api/guilds/:guildId/welcome/test",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.test.execute")],
      schema: withDocs(
        { params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
        {
          tag: "Welcome",
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                channelId: { type: "string" },
              },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const config = await getWelcomeConfig(guildId);

      if (!config || !config.welcomeEnabled) {
        reply.code(400).send({ error: "Welcome messages are not enabled" });
        return;
      }

      if (!config.welcomeChannelId) {
        reply.code(400).send({ error: "No welcome channel configured" });
        return;
      }

      reply.send({ success: true, channelId: config.welcomeChannelId });
    },
  );

  // ── Welcome Image Endpoints ──

  // POST generate a preview image
  app.post(
    "/api/guilds/:guildId/welcome/image/preview",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.view")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            properties: {
              settings: { type: "object", additionalProperties: true },
              type: { type: "string", enum: ["welcome", "farewell"] },
            },
            required: ["settings"],
          },
        },
        {
          tag: "Welcome",
          response: { 200: { type: "string", format: "binary" } },
        },
      ),
    },
    async (request, reply) => {
      const body = request.body as { settings: unknown; type?: string };
      const defaults = body.type === "farewell"
        ? DEFAULT_FAREWELL_IMAGE_SETTINGS
        : DEFAULT_WELCOME_IMAGE_SETTINGS;

      const parsed = welcomeImageSettingsSchema.safeParse({ ...defaults, ...(body.settings as object) });
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid image settings", details: parsed.error.flatten() });
        return;
      }

      const session = request.session!;
      const imageBuffer = await generateWelcomeImage({
        settings: parsed.data,
        member: {
          username: session.username ?? "User",
          displayName: session.username ?? "User",
          avatarUrl: session.avatar
            ? `https://cdn.discordapp.com/avatars/${session.userId}/${session.avatar}.png?size=256`
            : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(session.userId) >> 22n) % 6}.png`,
        },
        guild: {
          name: "Your Server",
          memberCount: 1234,
        },
        storage,
      });

      reply
        .header("Content-Type", "image/png")
        .header("Cache-Control", "no-cache")
        .header("X-Content-Type-Options", "nosniff")
        .send(imageBuffer);
    },
  );

  // POST upload a background image (accepts base64-encoded image in JSON body)
  app.post(
    "/api/guilds/:guildId/welcome/image/background",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            properties: {
              data: { type: "string" },
              contentType: { type: "string" },
            },
            required: ["data", "contentType"],
          },
        },
        {
          tag: "Welcome",
          response: {
            200: {
              type: "object",
              properties: { key: { type: "string" } },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const { data, contentType } = request.body as { data: string; contentType: string };

      if (!ALLOWED_BACKGROUND_TYPES.includes(contentType)) {
        reply.code(400).send({
          error: `Invalid file type. Allowed: ${ALLOWED_BACKGROUND_TYPES.join(", ")}`,
        });
        return;
      }

      // Strict base64 validation (RFC 4648, optional padding)
      const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
      if (data.length === 0 || data.length % 4 !== 0 || !base64Regex.test(data)) {
        reply.code(400).send({ error: "Invalid base64 payload" });
        return;
      }

      const buffer = Buffer.from(data, "base64");
      if (buffer.length === 0) {
        reply.code(400).send({ error: "Empty payload" });
        return;
      }

      if (buffer.length > MAX_BACKGROUND_SIZE) {
        reply.code(400).send({
          error: `File too large. Maximum size: ${MAX_BACKGROUND_SIZE / 1024 / 1024} MB`,
        });
        return;
      }

      // Magic byte sniffing — must match contentType
      const detected = detectImageType(buffer);
      if (!detected || detected !== contentType) {
        reply.code(400).send({
          error: "File content does not match the declared image type",
        });
        return;
      }

      const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
      const key = `backgrounds/${guildId}/${randomUUID()}.${ext}`;

      await storage.upload(key, buffer, contentType);

      reply.send({ key });
    },
  );

  // DELETE remove a background image
  app.delete(
    "/api/guilds/:guildId/welcome/image/background",
    {
      preHandler: [requireAuth, requireGuildAdmin, requirePermission("welcome.config.manage")],
      schema: withDocs(
        {
          params: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] },
          body: {
            type: "object",
            properties: {
              key: { type: "string" },
            },
            required: ["key"],
          },
        },
        {
          tag: "Welcome",
          response: {
            200: {
              type: "object",
              properties: { success: { type: "boolean" } },
            },
          },
        },
      ),
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const { key } = request.body as { key: string };

      // Ensure the key belongs to this guild (prevent cross-guild deletion)
      if (!key.startsWith(`backgrounds/${guildId}/`)) {
        reply.code(403).send({ error: "Cannot delete resources from another guild" });
        return;
      }

      await storage.delete(key);
      reply.send({ success: true });
    },
  );

  // GET available templates
  app.get(
    "/api/welcome/templates",
    {
      preHandler: [requireAuth],
      schema: withDocs(undefined, {
        tag: "Welcome",
        response: {
          200: {
            type: "object",
            properties: { templates: { type: "array", items: {} } },
          },
        },
      }),
    },
    async (_request, reply) => {
      reply.send({
        templates: getAllTemplates().map((t) => ({
          name: t.name,
          displayName: t.displayName,
          description: t.description,
          canvas: t.canvas,
        })),
      });
    },
  );

  // GET available fonts
  app.get(
    "/api/welcome/fonts",
    {
      preHandler: [requireAuth],
      schema: withDocs(undefined, {
        tag: "Welcome",
        response: {
          200: {
            type: "object",
            properties: { fonts: { type: "array", items: {} } },
          },
        },
      }),
    },
    async (_request, reply) => {
      reply.send({ fonts: getAvailableFonts() });
    },
  );

  // GET preset backgrounds
  app.get(
    "/api/welcome/presets",
    {
      preHandler: [requireAuth],
      schema: withDocs(undefined, {
        tag: "Welcome",
        response: {
          200: {
            type: "object",
            properties: { backgrounds: {} },
          },
        },
      }),
    },
    async (_request, reply) => {
      reply.send({ backgrounds: PRESET_BACKGROUNDS });
    },
  );
}

function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
