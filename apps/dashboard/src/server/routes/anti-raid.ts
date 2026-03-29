import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import {
  getAntiRaidConfig,
  upsertAntiRaidConfig,
} from "@fluxcore/systems/antiraid/config";
import { getRaidEvents } from "@fluxcore/systems/antiraid/persistence";
import { VALID_RAID_ACTIONS, RAID_EVENT_PAGE_SIZE } from "@fluxcore/systems/antiraid/constants";
import type { RaidAction } from "@fluxcore/systems/antiraid/types";

export function registerAntiRaidRoutes(app: FastifyInstance): void {
  // GET anti-raid config
  app.get(
    "/api/guilds/:guildId/antiraid-config",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const config = await getAntiRaidConfig(guildId);
      reply.send(config);
    },
  );

  // PUT update anti-raid config
  app.put(
    "/api/guilds/:guildId/antiraid-config",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            joinThreshold: { type: "integer", minimum: 2, maximum: 100 },
            joinWindow: { type: "integer", minimum: 1, maximum: 120 },
            joinAction: { type: "string", enum: VALID_RAID_ACTIONS },
            accountAgeMinDays: { type: "integer", minimum: 0, maximum: 365 },
            accountAgeAction: { type: "string", enum: VALID_RAID_ACTIONS },
            antiNukeEnabled: { type: "boolean" },
            antiNukeThreshold: { type: "integer", minimum: 1, maximum: 20 },
            lockdownOnRaid: { type: "boolean" },
            whitelistedRoleIds: { type: "array", items: { type: "string" } },
            logChannelId: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Partial<{
        enabled: boolean;
        joinThreshold: number;
        joinWindow: number;
        joinAction: RaidAction;
        accountAgeMinDays: number;
        accountAgeAction: RaidAction;
        antiNukeEnabled: boolean;
        antiNukeThreshold: number;
        lockdownOnRaid: boolean;
        whitelistedRoleIds: string[];
        logChannelId: string | null;
      }>;

      const config = await upsertAntiRaidConfig(guildId, body);
      reply.send(config);
    },
  );

  // GET raid events (paginated)
  app.get(
    "/api/guilds/:guildId/raid-events",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as { page?: string; limit?: string };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit
        ? Math.min(parseInt(query.limit, 10), 50)
        : RAID_EVENT_PAGE_SIZE;

      const result = await getRaidEvents(
        guildId,
        Number.isFinite(page) && page > 0 ? page : 1,
        Number.isFinite(limit) && limit > 0 ? limit : RAID_EVENT_PAGE_SIZE,
      );

      reply.send(result);
    },
  );
}
