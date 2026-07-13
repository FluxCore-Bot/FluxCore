import { describe, it, expect, vi, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    dashboardClientSecret: "test-secret",
    dashboardSessionSecret: "session-secret",
    dashboardCallbackUrl: "http://localhost:3000/auth/callback",
    dashboardPublicUrl: "http://localhost:3000",
    dashboardPort: 3000,
  },
}));

import { registerOpenApi } from "../../src/server/shared/openapi.js";
import { registerAuthRoutes } from "../../src/server/features/auth/routes.js";
import { registerGuildRoutes } from "../../src/server/features/guilds/routes.js";
import { registerTempVoiceRoutes } from "../../src/server/features/tempvoice/routes.js";
import { registerActionRoutes } from "../../src/server/features/actions/routes.js";
import { registerDiscordRoutes } from "../../src/server/features/discord/routes.js";
import { registerMusicRoutes } from "../../src/server/features/music/routes.js";
import { registerLoggingRoutes } from "../../src/server/features/logging/routes.js";
import { registerWarningRoutes } from "../../src/server/features/moderation/warnings-routes.js";
import { registerModerationRoutes } from "../../src/server/features/moderation/routes.js";
import { registerWelcomeRoutes } from "../../src/server/features/welcome/routes.js";
import { registerRolePanelRoutes } from "../../src/server/features/roles/routes.js";
import { registerLevelingRoutes } from "../../src/server/features/leveling/routes.js";
import { registerScheduledMessageRoutes } from "../../src/server/features/scheduled/routes.js";
import { registerCustomCommandRoutes } from "../../src/server/features/commands/routes.js";
import { registerAntiRaidRoutes } from "../../src/server/features/security/routes.js";
import { registerTicketRoutes } from "../../src/server/features/tickets/routes.js";
import { registerGiveawayRoutes } from "../../src/server/features/giveaways/routes.js";
import { registerSuggestionRoutes } from "../../src/server/features/suggestions/routes.js";
import { registerStarboardRoutes } from "../../src/server/features/starboard/routes.js";
import { registerDashboardRoleRoutes } from "../../src/server/features/permissions/roles-routes.js";
import { registerDashboardPermissionRoutes } from "../../src/server/features/permissions/routes.js";

const EXPECTED_TAGS = [
  "Meta", "Auth", "Guilds", "TempVoice", "Actions", "Discord", "Music",
  "Logging", "Moderation", "Warnings", "Welcome", "RolePanels", "Leveling",
  "ScheduledMessages", "CustomCommands", "AntiRaid", "Tickets", "Giveaways",
  "Suggestions", "Starboard", "DashboardPermissions", "DashboardRoles",
];

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await registerOpenApi(app);
  registerAuthRoutes(app);
  registerGuildRoutes(app);
  registerTempVoiceRoutes(app);
  registerActionRoutes(app);
  registerDiscordRoutes(app);
  registerMusicRoutes(app);
  registerLoggingRoutes(app);
  registerWarningRoutes(app);
  registerModerationRoutes(app);
  registerWelcomeRoutes(app);
  registerRolePanelRoutes(app);
  registerLevelingRoutes(app);
  registerScheduledMessageRoutes(app);
  registerCustomCommandRoutes(app);
  registerAntiRaidRoutes(app);
  registerTicketRoutes(app);
  registerGiveawayRoutes(app);
  registerSuggestionRoutes(app);
  registerStarboardRoutes(app);
  registerDashboardRoleRoutes(app);
  registerDashboardPermissionRoutes(app);
  await app.ready();
});

describe("OpenAPI documentation", () => {
  it("serves the Swagger UI at /docs", async () => {
    const res = await app.inject({ method: "GET", url: "/docs" });
    expect(res.statusCode).toBe(200);
  });

  it("exposes a valid OpenAPI document at /docs/json", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/json" });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.openapi).toBeDefined();
    expect(doc.paths).toBeDefined();
  });

  it("declares the session-cookie security scheme", async () => {
    const doc = (await app.inject({ method: "GET", url: "/docs/json" })).json();
    expect(doc.components?.securitySchemes?.sessionCookie).toMatchObject({
      type: "apiKey",
      in: "cookie",
      name: "session",
    });
  });

  it("documents every module under its own tag", async () => {
    const doc = (await app.inject({ method: "GET", url: "/docs/json" })).json();
    const tagNames = doc.tags.map((t: { name: string }) => t.name).sort();
    for (const tag of EXPECTED_TAGS) {
      expect(tagNames).toContain(tag);
    }
  });

  it("tags every route and assigns no route to a missing tag", async () => {
    const doc = (await app.inject({ method: "GET", url: "/docs/json" })).json();
    const declared = new Set(doc.tags.map((t: { name: string }) => t.name));
    const untagged: string[] = [];
    for (const [path, methods] of Object.entries<
      Record<string, { tags?: string[] }>
    >(doc.paths)) {
      for (const op of Object.values(methods)) {
        const tags = op.tags ?? [];
        if (tags.length === 0) untagged.push(path);
        for (const t of tags) {
          if (!declared.has(t)) untagged.push(`${path} (${t})`);
        }
      }
    }
    expect(untagged).toEqual([]);
  });
});
