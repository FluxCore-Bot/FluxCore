/**
 * Discord channel-type numbers and the one definition of "a channel a message
 * or a filter can target".
 *
 * Three components previously each hardcoded `c.type === 0 || c.type === 2`,
 * which silently excluded announcement, stage, forum and media channels
 * everywhere: a rule could not be scoped to an announcement channel, and a
 * Send Message action could not target one. Import from here instead.
 *
 * Values mirror Discord's ChannelType enum. We don't import discord.js into
 * the browser bundle for six integers.
 */
export const CHANNEL_TYPE = {
  GuildText: 0,
  GuildVoice: 2,
  GuildCategory: 4,
  GuildAnnouncement: 5,
  AnnouncementThread: 10,
  PublicThread: 11,
  PrivateThread: 12,
  GuildStageVoice: 13,
  GuildForum: 15,
  GuildMedia: 16,
} as const;

/**
 * Channels that can hold messages, and so can be picked as a Send Message /
 * Log to Channel target or as a trigger filter.
 *
 * Threads are excluded deliberately: they are transient, there can be
 * thousands, and a filter should name the parent (which
 * `EventContext.parentChannelId` now carries) rather than one thread.
 * Categories are excluded because they hold no messages of their own.
 */
const MESSAGEABLE: ReadonlySet<number> = new Set([
  CHANNEL_TYPE.GuildText,
  CHANNEL_TYPE.GuildVoice,
  CHANNEL_TYPE.GuildAnnouncement,
  CHANNEL_TYPE.GuildStageVoice,
  CHANNEL_TYPE.GuildForum,
  CHANNEL_TYPE.GuildMedia,
]);

export function isMessageableChannel(type: number): boolean {
  return MESSAGEABLE.has(type);
}

/** Icon name (see shared/components/Icon) for a channel type. */
export function channelIconName(type: number): string {
  switch (type) {
    case CHANNEL_TYPE.GuildVoice:
      return "volume_up";
    case CHANNEL_TYPE.GuildStageVoice:
      return "podcasts";
    case CHANNEL_TYPE.GuildAnnouncement:
      return "campaign";
    case CHANNEL_TYPE.GuildForum:
    case CHANNEL_TYPE.GuildMedia:
      return "forum";
    case CHANNEL_TYPE.GuildCategory:
      return "folder";
    default:
      return "hash";
  }
}

/** Text prefix used where an icon component cannot be rendered. */
export function channelLabelPrefix(type: number): string {
  switch (type) {
    case CHANNEL_TYPE.GuildVoice:
      return "🔊";
    case CHANNEL_TYPE.GuildStageVoice:
      return "🎙️";
    case CHANNEL_TYPE.GuildAnnouncement:
      return "📢";
    case CHANNEL_TYPE.GuildForum:
    case CHANNEL_TYPE.GuildMedia:
      return "💬";
    case CHANNEL_TYPE.GuildCategory:
      return "📁";
    default:
      return "#";
  }
}
