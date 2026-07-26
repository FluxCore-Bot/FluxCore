export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedConfig {
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: string;
  image?: string;
  footer?: string;
  fields?: EmbedField[];
}

export interface WelcomeImageSettings {
  template: string;
  background: { type: "color" | "image" | "preset"; color: string; imageKey?: string; preset?: string };
  overlay: { enabled: boolean; color: string; opacity: number };
  avatar: { shape: "circle" | "rounded" | "square"; borderColor: string; borderWidth: number; glowEnabled: boolean; glowColor: string };
  title: { font: string; color: string; size: number };
  subtitle: { font: string; color: string; size: number; text: string };
  accentColor: string;
  sendMode: "with" | "before" | "only";
}

/** How a welcome/farewell message is delivered. */
export type MessageStyle = "plain" | "embed";

/**
 * The subset of a Discord GuildMember that welcome/farewell rendering
 * actually reads (variable substitution + the image renderer's member
 * input). Kept as a plain structural interface rather than naming
 * discord.js's `GuildMember` directly, so a real GuildMember satisfies it
 * for free in production while unit tests can pass a bare object literal
 * with no `as` cast — GuildMember has dozens of unrelated required members
 * (kick, ban, timeout, ...) that nothing here touches.
 */
export interface WelcomeMember {
  id: string;
  displayName: string;
  user: {
    tag: string;
    username: string;
    displayAvatarURL(options?: { size?: number; extension?: string }): string;
  };
  guild: {
    id: string;
    name: string;
    memberCount: number;
    iconURL(options?: { size?: number }): string | null;
  };
}

export interface WelcomeConfig {
  guildId: string;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: EmbedConfig;
  welcomeMessageStyle: MessageStyle;
  welcomeContent: string;
  farewellEnabled: boolean;
  farewellChannelId: string | null;
  farewellMessage: EmbedConfig;
  farewellMessageStyle: MessageStyle;
  farewellContent: string;
  dmEnabled: boolean;
  dmMessage: EmbedConfig;
  autoRoleIds: string[];
  welcomeImageEnabled: boolean;
  welcomeImageConfig: WelcomeImageSettings;
  farewellImageEnabled: boolean;
  farewellImageConfig: WelcomeImageSettings;
}
