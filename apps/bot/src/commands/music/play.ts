import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import { getMusicSettings } from "@fluxcore/systems/music/config";
import { searchAlbums, getAlbumWithTracks, findTrackByUrl } from "@fluxcore/systems/music/library";
import type { QueueTrack, MusicLibraryAlbum, MusicLibraryTrack } from "@fluxcore/systems/music/types";
import { DEFAULT_SEARCH_PREFIX } from "@fluxcore/systems/music/constants";
import { errorEmbed, successEmbed, logger } from "@fluxcore/utils";
import { requireVoiceChannel, requireSameVoiceChannel } from "../../systems/music/guards.js";
import { getQueue, createQueue } from "../../systems/music/queue.js";
import { getShoukaku } from "../../systems/music/shoukaku.js";
import { setupPlayerEvents } from "../../systems/music/events.js";
import { trackAddedEmbed } from "../../systems/music/embeds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or add it to the queue")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("URL or search term (open mode) / album:track (library mode)")
        .setRequired(true)
        .setAutocomplete(true),
    ),
  category: "Music",
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const voiceChannelId = await requireVoiceChannel(interaction);
    if (!voiceChannelId) return;
    if (!(await requireSameVoiceChannel(interaction))) return;

    const guildId = interaction.guildId!;
    const settings = getMusicSettings(guildId);
    const query = interaction.options.getString("query", true);

    await interaction.deferReply();

    try {
      // In library mode, validate the query is a library track or album
      if (settings.mode === "library") {
        // If query ends with ":", treat it as an album selection — queue all tracks
        if (query.endsWith(":")) {
          const albumName = query.slice(0, -1).trim();
          const album = await getAlbumWithTracks(guildId, albumName);
          if (!album || album.tracks.length === 0) {
            await interaction.editReply({
              embeds: [errorEmbed("Album Not Found", `No album named **${albumName}** found, or it has no tracks.`)],
            });
            return;
          }

          let queue = getQueue(guildId);
          const isNew = !queue;
          if (!queue) {
            queue = await createQueue(guildId, interaction.channelId, voiceChannelId, interaction.client);
            setupPlayerEvents(guildId, interaction.client);
          }

          const remaining = settings.maxQueueSize - queue.tracks.length;
          const tracksToAdd = album.tracks.slice(0, remaining);

          for (const t of tracksToAdd) {
            const track: QueueTrack = {
              title: t.title,
              url: t.sourceUrl,
              duration: t.duration ?? 0,
              requester: interaction.user.id,
              thumbnail: null,
            };
            queue.add(track);
          }

          if (isNew || !queue.current) {
            await queue.playNext();
          }

          await interaction.editReply({
            embeds: [
              successEmbed(
                "Album Queued",
                `Added **${tracksToAdd.length}** track(s) from **${album.name}**`,
              ),
            ],
          });
          return;
        }

        const libraryTrack = await findTrackByUrl(guildId, query);
        if (!libraryTrack) {
          await interaction.editReply({
            embeds: [
              errorEmbed(
                "Library Mode",
                "This server is in **library mode**. You can only play tracks from the library.\nUse the autocomplete to browse available tracks.",
              ),
            ],
          });
          return;
        }
      }

      // Resolve the track via Lavalink
      const shoukaku = getShoukaku();
      const node = shoukaku.getIdealNode();
      if (!node) {
        await interaction.editReply({
          embeds: [errorEmbed("Error", "No audio server available. Please try again later.")],
        });
        return;
      }

      const isUrl = /^https?:\/\//.test(query);
      const searchQuery = isUrl ? query : `${DEFAULT_SEARCH_PREFIX}${query}`;
      const result = await node.rest.resolve(searchQuery);

      if (!result?.data || result.loadType === "empty" || result.loadType === "error") {
        await interaction.editReply({
          embeds: [errorEmbed("No Results", `No results found for \`${query}\`.`)],
        });
        return;
      }

      // Get or create the queue
      let queue = getQueue(guildId);
      const isNew = !queue;
      if (!queue) {
        queue = await createQueue(guildId, interaction.channelId, voiceChannelId, interaction.client);
        setupPlayerEvents(guildId, interaction.client);
      }

      // Check queue size
      if (queue.tracks.length >= settings.maxQueueSize) {
        await interaction.editReply({
          embeds: [errorEmbed("Queue Full", `The queue is full (max ${settings.maxQueueSize} tracks).`)],
        });
        return;
      }

      // Handle playlist
      if (result.loadType === "playlist" && "tracks" in result.data) {
        const playlist = result.data;
        const remaining = settings.maxQueueSize - queue.tracks.length;
        const tracksToAdd = playlist.tracks.slice(0, remaining);

        for (const t of tracksToAdd) {
          const track: QueueTrack = {
            title: t.info.title,
            url: t.info.uri ?? query,
            duration: Math.floor(t.info.length / 1000),
            requester: interaction.user.id,
            thumbnail: t.info.artworkUrl ?? null,
            encoded: t.encoded,
          };
          queue.add(track);
        }

        if (isNew || !queue.current) {
          await queue.playNext();
        }

        await interaction.editReply({
          embeds: [
            successEmbed(
              "Playlist Added",
              `Added **${tracksToAdd.length}** tracks from **${playlist.info.name}**`,
            ),
          ],
        });
        return;
      }

      // Single track
      const lavalinkTrack =
        result.loadType === "track"
          ? result.data
          : result.loadType === "search" && Array.isArray(result.data)
            ? result.data[0]
            : null;

      if (!lavalinkTrack) {
        await interaction.editReply({
          embeds: [errorEmbed("No Results", `No playable track found.`)],
        });
        return;
      }

      const track: QueueTrack = {
        title: lavalinkTrack.info.title,
        url: lavalinkTrack.info.uri ?? query,
        duration: Math.floor(lavalinkTrack.info.length / 1000),
        requester: interaction.user.id,
        thumbnail: lavalinkTrack.info.artworkUrl ?? null,
        encoded: lavalinkTrack.encoded,
      };

      if (isNew || !queue.current) {
        queue.add(track);
        await queue.playNext();
        await interaction.editReply({
          embeds: [successEmbed("Now Playing", `**[${track.title}](${track.url})**`)],
        });
      } else {
        const position = queue.add(track);
        await interaction.editReply({
          embeds: [trackAddedEmbed(track, position)],
        });
      }
    } catch (error) {
      logger.error(
        "Error in play command",
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Error", "An error occurred while trying to play the track.")],
      });
    }
  },
};

export default command;

export async function handlePlayAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const guildId = interaction.guildId!;
  const settings = getMusicSettings(guildId);

  if (settings.mode !== "library") {
    await interaction.respond([]);
    return;
  }

  const focused = interaction.options.getFocused();

  // If the query contains ":", treat first part as album, second as track search
  if (focused.includes(":")) {
    const [albumQuery, trackQuery] = focused.split(":", 2);
    const album = await getAlbumWithTracks(guildId, albumQuery.trim());
    if (!album) {
      await interaction.respond([]);
      return;
    }
    const filtered = album.tracks
      .filter((t: MusicLibraryTrack) => t.title.toLowerCase().includes((trackQuery ?? "").toLowerCase()))
      .slice(0, 25);
    await interaction.respond(
      filtered.map((t: MusicLibraryTrack) => ({
        name: `${album.name}: ${t.title}`,
        value: t.sourceUrl,
      })),
    );
    return;
  }

  // Otherwise show albums
  const albums = await searchAlbums(guildId, focused);
  await interaction.respond(
    albums.map((a: MusicLibraryAlbum) => ({
      name: a.name,
      value: `${a.name}:`,
    })),
  );
}
