import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import {
  createGiveaway,
  getGiveaway,
  listGiveaways,
  endGiveaway,
} from "@fluxcore/systems/giveaways/persistence";
import { selectWinners, rerollWinners } from "@fluxcore/systems/giveaways/winner";
import {
  GIVEAWAY_PAGE_SIZE,
  MAX_WINNERS,
  MAX_PRIZE_LENGTH,
  MAX_ACTIVE_GIVEAWAYS,
} from "@fluxcore/systems/giveaways/constants";
import { getActiveGiveawayCount } from "@fluxcore/systems/giveaways/persistence";

function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerGiveawayRoutes(app: FastifyInstance): void {
  // GET list giveaways
  app.get(
    "/api/guilds/:guildId/giveaways",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const query = request.query as { active?: string; page?: string; limit?: string };

      const active = query.active === "true" ? true : query.active === "false" ? false : undefined;
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit
        ? Math.min(parseInt(query.limit, 10), 50)
        : GIVEAWAY_PAGE_SIZE;

      const result = await listGiveaways(guildId, {
        active,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: Number.isFinite(limit) && limit > 0 ? limit : GIVEAWAY_PAGE_SIZE,
      });

      reply.send(result);
    },
  );

  // POST create giveaway
  app.post(
    "/api/guilds/:guildId/giveaways",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          required: ["channelId", "prize", "winners", "durationMs"],
          properties: {
            channelId: { type: "string", minLength: 1 },
            prize: { type: "string", minLength: 1, maxLength: MAX_PRIZE_LENGTH },
            winners: { type: "integer", minimum: 1, maximum: MAX_WINNERS },
            durationMs: { type: "integer", minimum: 60000 }, // min 1 minute
            requiredRoleIds: {
              type: "array",
              items: { type: "string" },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        channelId: string;
        prize: string;
        winners: number;
        durationMs: number;
        requiredRoleIds?: string[];
      };

      // Check active giveaway limit
      const activeCount = await getActiveGiveawayCount(guildId);
      if (activeCount >= MAX_ACTIVE_GIVEAWAYS) {
        reply.code(400).send({
          error: `Maximum of ${MAX_ACTIVE_GIVEAWAYS} active giveaways reached`,
        });
        return;
      }

      const session = (request as Record<string, unknown>).session as {
        userId: string;
      };

      const endsAt = new Date(Date.now() + body.durationMs);
      const giveaway = await createGiveaway({
        guildId,
        channelId: body.channelId,
        hostId: session.userId,
        prize: body.prize,
        winners: body.winners,
        endsAt,
        requiredRoleIds: body.requiredRoleIds,
      });

      reply.code(201).send(giveaway);
    },
  );

  // PUT end giveaway early
  app.put(
    "/api/guilds/:guildId/giveaways/:id/end",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const giveawayId = parseIntParam(id);
      if (giveawayId === null) {
        reply.code(400).send({ error: "Invalid giveaway ID" });
        return;
      }

      const giveaway = await getGiveaway(giveawayId, guildId);
      if (!giveaway) {
        reply.code(404).send({ error: "Giveaway not found" });
        return;
      }

      if (giveaway.ended) {
        reply.code(400).send({ error: "Giveaway has already ended" });
        return;
      }

      const winners = selectWinners(giveaway);
      const ended = await endGiveaway(giveawayId, winners);
      reply.send(ended);
    },
  );

  // POST reroll giveaway
  app.post(
    "/api/guilds/:guildId/giveaways/:id/reroll",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const giveawayId = parseIntParam(id);
      if (giveawayId === null) {
        reply.code(400).send({ error: "Invalid giveaway ID" });
        return;
      }

      const giveaway = await getGiveaway(giveawayId, guildId);
      if (!giveaway) {
        reply.code(404).send({ error: "Giveaway not found" });
        return;
      }

      if (!giveaway.ended) {
        reply.code(400).send({ error: "Giveaway has not ended yet" });
        return;
      }

      const newWinners = rerollWinners(giveaway);
      if (newWinners.length === 0) {
        reply.code(400).send({ error: "No eligible entrants remaining for reroll" });
        return;
      }

      const updated = await endGiveaway(giveawayId, newWinners);
      reply.send(updated);
    },
  );
}
