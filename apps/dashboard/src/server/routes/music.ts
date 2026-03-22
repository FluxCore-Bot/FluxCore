import type { FastifyInstance } from "fastify";
import { requireAuth, requireGuildAdmin } from "../middleware.js";
import {
  getMusicSettings,
  upsertMusicSettings,
} from "@fluxcore/systems/music/config";
import {
  getAlbums,
  getAlbumById,
  addAlbum,
  removeAlbum,
  addTrack,
  removeTrack,
  getAlbumTracks,
  getAlbumCount,
  getTrackCount,
} from "@fluxcore/systems/music/library";
import {
  MAX_QUEUE_SIZE_LIMIT,
  MAX_LIBRARY_ALBUMS_PER_GUILD,
  MAX_TRACKS_PER_ALBUM,
} from "@fluxcore/systems/music/constants";
import { notifyCacheInvalidation } from "@fluxcore/systems/actions/persistence";

export function registerMusicRoutes(app: FastifyInstance): void {
  // GET music settings for a guild
  app.get(
    "/api/guilds/:guildId/music/settings",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const settings = getMusicSettings(guildId);
      reply.send(settings);
    },
  );

  // PUT update music settings
  app.put(
    "/api/guilds/:guildId/music/settings",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as {
        mode?: string;
        djRoleId?: string | null;
        defaultVolume?: number;
        maxQueueSize?: number;
        autoDisconnectSecs?: number;
        twentyFourSeven?: boolean;
      };

      const update: Record<string, unknown> = {};

      if (body.mode !== undefined) {
        if (body.mode !== "open" && body.mode !== "library") {
          reply.code(400).send({ error: "mode must be 'open' or 'library'" });
          return;
        }
        update.mode = body.mode;
      }

      if (body.djRoleId !== undefined) {
        update.djRoleId = body.djRoleId;
      }

      if (body.defaultVolume !== undefined) {
        if (body.defaultVolume < 0 || body.defaultVolume > 100) {
          reply.code(400).send({ error: "defaultVolume must be between 0 and 100" });
          return;
        }
        update.defaultVolume = body.defaultVolume;
      }

      if (body.maxQueueSize !== undefined) {
        if (body.maxQueueSize < 1 || body.maxQueueSize > MAX_QUEUE_SIZE_LIMIT) {
          reply.code(400).send({ error: `maxQueueSize must be between 1 and ${MAX_QUEUE_SIZE_LIMIT}` });
          return;
        }
        update.maxQueueSize = body.maxQueueSize;
      }

      if (body.autoDisconnectSecs !== undefined) {
        if (body.autoDisconnectSecs < 0 || body.autoDisconnectSecs > 3600) {
          reply.code(400).send({ error: "autoDisconnectSecs must be between 0 and 3600" });
          return;
        }
        update.autoDisconnectSecs = body.autoDisconnectSecs;
      }

      if (body.twentyFourSeven !== undefined) {
        update.twentyFourSeven = body.twentyFourSeven;
      }

      const settings = await upsertMusicSettings(guildId, update);
      await notifyCacheInvalidation(guildId, "reloadMusic");
      reply.send(settings);
    },
  );

  // GET all albums for a guild
  app.get(
    "/api/guilds/:guildId/music/library",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const albums = await getAlbums(guildId);
      reply.send(albums);
    },
  );

  // POST create an album
  app.post(
    "/api/guilds/:guildId/music/library",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as { name?: string };

      if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
        reply.code(400).send({ error: "Album name is required" });
        return;
      }

      const count = await getAlbumCount(guildId);
      if (count >= MAX_LIBRARY_ALBUMS_PER_GUILD) {
        reply.code(400).send({ error: `Album limit reached (max ${MAX_LIBRARY_ALBUMS_PER_GUILD})` });
        return;
      }

      try {
        const session = (request as unknown as { session: { userId: string } }).session;
        const album = await addAlbum(guildId, body.name.trim(), session.userId);
        reply.code(201).send(album);
      } catch {
        reply.code(400).send({ error: "An album with this name already exists" });
      }
    },
  );

  // DELETE an album
  app.delete(
    "/api/guilds/:guildId/music/library/:albumId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, albumId } = request.params as { guildId: string; albumId: string };
      const album = await getAlbumById(Number(albumId));
      if (!album || album.guildId !== guildId) {
        reply.code(404).send({ error: "Album not found" });
        return;
      }
      await removeAlbum(Number(albumId));
      reply.send({ success: true });
    },
  );

  // GET tracks in an album
  app.get(
    "/api/guilds/:guildId/music/library/:albumId/tracks",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, albumId } = request.params as { guildId: string; albumId: string };
      const album = await getAlbumById(Number(albumId));
      if (!album || album.guildId !== guildId) {
        reply.code(404).send({ error: "Album not found" });
        return;
      }
      const tracks = await getAlbumTracks(Number(albumId));
      reply.send(tracks);
    },
  );

  // POST add a track to an album
  app.post(
    "/api/guilds/:guildId/music/library/:albumId/tracks",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, albumId } = request.params as { guildId: string; albumId: string };
      const body = request.body as { title?: string; sourceUrl?: string; duration?: number | null };

      const album = await getAlbumById(Number(albumId));
      if (!album || album.guildId !== guildId) {
        reply.code(404).send({ error: "Album not found" });
        return;
      }

      if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
        reply.code(400).send({ error: "Track title is required" });
        return;
      }

      if (!body.sourceUrl || typeof body.sourceUrl !== "string" || !body.sourceUrl.trim()) {
        reply.code(400).send({ error: "Track source URL is required" });
        return;
      }

      const trackCount = await getTrackCount(Number(albumId));
      if (trackCount >= MAX_TRACKS_PER_ALBUM) {
        reply.code(400).send({ error: `Track limit reached (max ${MAX_TRACKS_PER_ALBUM} per album)` });
        return;
      }

      const session = (request as unknown as { session: { userId: string } }).session;
      const track = await addTrack(
        Number(albumId),
        body.title.trim(),
        body.sourceUrl.trim(),
        body.duration ?? null,
        session.userId,
      );
      reply.code(201).send(track);
    },
  );

  // DELETE a track
  app.delete(
    "/api/guilds/:guildId/music/library/:albumId/tracks/:trackId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { albumId, guildId } = request.params as { guildId: string; albumId: string; trackId: string };
      const album = await getAlbumById(Number(albumId));
      if (!album || album.guildId !== guildId) {
        reply.code(404).send({ error: "Album not found" });
        return;
      }
      const { trackId } = request.params as { trackId: string };
      try {
        await removeTrack(Number(trackId));
        reply.send({ success: true });
      } catch {
        reply.code(404).send({ error: "Track not found" });
      }
    },
  );
}
