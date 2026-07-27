import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import type { MessageMentionOptions } from "discord.js";
import { logger } from "@fluxcore/utils";
import { buildWelcomeEmbed, replaceWelcomeVariables } from "./builder.js";
import { generateWelcomeImage, createStorageAdapter, sanitizeDisplayName } from "./image/index.js";
import type { EmbedConfig, MessageStyle, WelcomeImageSettings, WelcomeMember } from "./types.js";

/** Discord's hard limit on message content length. */
const MAX_CONTENT_LENGTH = 2000;

export interface SendPayload<TEmbed, TFile> {
  content?: string;
  embeds?: TEmbed[];
  files?: TFile[];
  allowedMentions?: MessageMentionOptions;
}

export interface SendPayloadInput<TEmbed, TFile> {
  style: MessageStyle;
  /** Plain-mode message text, variables already substituted. */
  content: string;
  embed: TEmbed;
  files: TFile[];
  /** Embed-mode only. Ignored when style is "plain". */
  sendMode: "with" | "before" | "only";
  /** The joining/leaving member's id — scopes the plain-mode mention lock. */
  memberId: string;
}

/**
 * Decide what to post for a welcome/farewell event.
 *
 * Returns one payload per message to send, in order. An empty array means
 * there is nothing worth posting.
 *
 * Plain style posts the image as a native full-width attachment rather than
 * boxed inside an embed, so `sendMode` does not apply to it.
 */
export function buildSendPayloads<TEmbed, TFile>(
  input: SendPayloadInput<TEmbed, TFile>,
): Array<SendPayload<TEmbed, TFile>> {
  const { style, content, embed, files, sendMode, memberId } = input;

  if (style === "plain") {
    const payload: SendPayload<TEmbed, TFile> = {};
    const trimmed = content.slice(0, MAX_CONTENT_LENGTH);
    if (trimmed.trim()) {
      payload.content = trimmed;
      // Lock allowedMentions so a moderator-configured plain-mode template
      // cannot ping @everyone/@here/roles. Embed mode never had this risk —
      // Discord doesn't parse mentions out of embeds — but plain mode's raw
      // content string does, and plain is the default style for new guilds.
      // {user} still resolves to a real mention (see replaceWelcomeVariables),
      // so the joining/leaving member themself stays pingable.
      payload.allowedMentions = { parse: [], users: [memberId] };
    }
    if (files.length > 0) payload.files = files;
    return payload.content || payload.files ? [payload] : [];
  }

  if (files.length > 0 && sendMode === "only") return [{ files }];
  if (files.length > 0 && sendMode === "before") return [{ files }, { embeds: [embed] }];
  return [{ embeds: [embed], files }];
}

/**
 * The subset of a Discord channel that welcome/farewell delivery actually
 * uses. A real `SendableChannels` satisfies this for free; unit tests can
 * pass a bare `{ send: vi.fn() }` with no `as` cast, since `SendableChannels`
 * is itself a large discord.js union that nothing here needs beyond `send`.
 */
interface MessageSink {
  send(payload: SendPayload<EmbedBuilder, AttachmentBuilder>): Promise<unknown>;
}

export interface DeliverOptions {
  channel: MessageSink;
  member: WelcomeMember;
  style: MessageStyle;
  /** Plain-mode text, variables NOT yet substituted. */
  content: string;
  embedConfig: EmbedConfig;
  imageEnabled: boolean;
  imageSettings: WelcomeImageSettings;
  /** "welcome.png" or "farewell.png". */
  attachmentName: string;
  /** "welcome" or "farewell" — used in log messages only. */
  label: string;
}

/**
 * Render the card (if enabled) and post the message.
 *
 * Shared by guildMemberAdd and guildMemberRemove so the two paths cannot
 * drift — notably in name sanitisation, which the farewell path previously
 * skipped entirely.
 */
export async function deliverWelcomeMessage(options: DeliverOptions): Promise<void> {
  const {
    channel, member, style, content, embedConfig,
    imageEnabled, imageSettings, attachmentName, label,
  } = options;

  const files: AttachmentBuilder[] = [];

  if (imageEnabled) {
    try {
      const imageBuffer = await generateWelcomeImage({
        settings: imageSettings,
        member: {
          username: sanitizeDisplayName(member.user.username, 32),
          displayName: sanitizeDisplayName(member.displayName, 80),
          avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256 }),
        },
        guild: {
          name: sanitizeDisplayName(member.guild.name, 80),
          iconUrl: member.guild.iconURL({ size: 256 }) ?? undefined,
          memberCount: member.guild.memberCount,
        },
        storage: createStorageAdapter(),
      });
      files.push(new AttachmentBuilder(imageBuffer, { name: attachmentName }));
    } catch (err) {
      logger.error(
        `Failed to generate ${label} image in guild ${member.guild.id}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  // Plain style never shows the embed (buildSendPayloads discards it below),
  // so it must not be exposed to a guild's stored embedConfig at all — e.g.
  // an out-of-range stored color throws inside EmbedBuilder.setColor, which
  // would otherwise take down the whole plain-mode send for no reason.
  const embed = style === "embed" ? buildWelcomeEmbed(embedConfig, member) : new EmbedBuilder();
  if (files.length > 0 && style === "embed") {
    embed.setImage(`attachment://${attachmentName}`);
  }

  const payloads = buildSendPayloads({
    style,
    content: replaceWelcomeVariables(content, member),
    embed,
    files,
    sendMode: imageSettings.sendMode ?? "with",
    memberId: member.id,
  });

  for (const payload of payloads) {
    await channel.send(payload).catch((err) =>
      logger.error(
        `Failed to send ${label} message in guild ${member.guild.id}`,
        err instanceof Error ? err : new Error(String(err)),
      ),
    );
  }
}
