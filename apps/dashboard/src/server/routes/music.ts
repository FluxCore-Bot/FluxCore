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
  getTrackById,
} from "@fluxcore/systems/music/library";
import {
  MAX_QUEUE_SIZE_LIMIT,
  MAX_LIBRARY_ALBUMS_PER_GUILD,
  MAX_TRACKS_PER_ALBUM,
} from "@fluxcore/systems/music/constants";
import { notifyCacheInvalidation } from "@fluxcore/systems/actions/persistence";

function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["open", "library"] },
            djRoleId: { type: ["string", "null"] },
            defaultVolume: { type: "integer", minimum: 0, maximum: 100 },
            maxQueueSize: { type: "integer", minimum: 1, maximum: MAX_QUEUE_SIZE_LIMIT },
            autoDisconnectSecs: { type: "integer", minimum: 0, maximum: 3600 },
            twentyFourSeven: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
    },
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

      if (body.mode !== undefined) update.mode = body.mode;
      if (body.djRoleId !== undefined) update.djRoleId = body.djRoleId;
      if (body.defaultVolume !== undefined) update.defaultVolume = body.defaultVolume;
      if (body.maxQueueSize !== undefined) update.maxQueueSize = body.maxQueueSize;
      if (body.autoDisconnectSecs !== undefined) update.autoDisconnectSecs = body.autoDisconnectSecs;
      if (body.twentyFourSeven !== undefined) update.twentyFourSeven = body.twentyFourSeven;

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
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as { name: string };

      const count = await getAlbumCount(guildId);
      if (count >= MAX_LIBRARY_ALBUMS_PER_GUILD) {
        reply.code(400).send({ error: `Album limit reached (max ${MAX_LIBRARY_ALBUMS_PER_GUILD})` });
        return;
      }

      try {
        const album = await addAlbum(guildId, body.name.trim(), request.session!.userId);
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
      const albumIdNum = parseIntParam(albumId);
      if (albumIdNum === null) {
        reply.code(400).send({ error: "Invalid album ID" });
        return;
      }
      const album = await getAlbumById(albumIdNum);
      if (!album || album.guildId !== guildId) {
        reply.code(404).send({ error: "Album not found" });
        return;
      }
      await removeAlbum(albumIdNum);
      reply.send({ success: true });
    },
  );

  // GET tracks in an album
  app.get(
    "/api/guilds/:guildId/music/library/:albumId/tracks",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, albumId } = request.params as { guildId: string; albumId: string };
      const albumIdNum = parseIntParam(albumId);
      if (albumIdNum === null) {
        reply.code(400).send({ error: "Invalid album ID" });
        return;
      }
      const album = await getAlbumById(albumIdNum);
      if (!album || album.guildId !== guildId) {
        reply.code(404).send({ error: "Album not found" });
        return;
      }
      const tracks = await getAlbumTracks(albumIdNum);
      reply.send(tracks);
    },
  );

  // POST add a track to an album
  app.post(
    "/api/guilds/:guildId/music/library/:albumId/tracks",
    {
      preHandler: [requireAuth, requireGuildAdmin],
      schema: {
        body: {
          type: "object",
          required: ["title", "sourceUrl"],
          properties: {
            title: { type: "string", minLength: 1 },
            sourceUrl: { type: "string", minLength: 1 },
            duration: { type: ["integer", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { guildId, albumId } = request.params as { guildId: string; albumId: string };
      const body = request.body as { title: string; sourceUrl: string; duration?: number | null };

      const albumIdNum = parseIntParam(albumId);
      if (albumIdNum === null) {
        reply.code(400).send({ error: "Invalid album ID" });
        return;
      }

      const album = await getAlbumById(albumIdNum);
      if (!album || album.guildId !== guildId) {
        reply.code(404).send({ error: "Album not found" });
        return;
      }

      try {
        const parsedUrl = new URL(body.sourceUrl.trim());
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          reply.code(400).send({ error: "sourceUrl must be an HTTP or HTTPS URL" });
          return;
        }
      } catch {
        reply.code(400).send({ error: "Invalid sourceUrl" });
        return;
      }

      const trackCount = await getTrackCount(albumIdNum);
      if (trackCount >= MAX_TRACKS_PER_ALBUM) {
        reply.code(400).send({ error: `Track limit reached (max ${MAX_TRACKS_PER_ALBUM} per album)` });
        return;
      }

      const track = await addTrack(
        albumIdNum,
        body.title.trim(),
        body.sourceUrl.trim(),
        body.duration ?? null,
        request.session!.userId,
      );
      reply.code(201).send(track);
    },
  );

  // DELETE a track
  app.delete(
    "/api/guilds/:guildId/music/library/:albumId/tracks/:trackId",
    { preHandler: [requireAuth, requireGuildAdmin] },
    async (request, reply) => {
      const { guildId, albumId, trackId } = request.params as {
        guildId: string;
        albumId: string;
        trackId: string;
      };

      const albumIdNum = parseIntParam(albumId);
      const trackIdNum = parseIntParam(trackId);
      if (albumIdNum === null || trackIdNum === null) {
        reply.code(400).send({ error: "Invalid album or track ID" });
        return;
      }

      const album = await getAlbumById(albumIdNum);
      if (!album || album.guildId !== guildId) {
        reply.code(404).send({ error: "Album not found" });
        return;
      }

      const track = await getTrackById(trackIdNum);
      if (!track || track.albumId !== albumIdNum) {
        reply.code(404).send({ error: "Track not found" });
        return;
      }

      await removeTrack(trackIdNum);
      reply.send({ success: true });
    },
  );
}
