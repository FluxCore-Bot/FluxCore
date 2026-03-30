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

export interface WelcomeConfig {
  guildId: string;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: EmbedConfig;
  farewellEnabled: boolean;
  farewellChannelId: string | null;
  farewellMessage: EmbedConfig;
  dmEnabled: boolean;
  dmMessage: EmbedConfig;
  autoRoleIds: string[];
  welcomeImageEnabled: boolean;
  welcomeImageConfig: WelcomeImageSettings;
  farewellImageEnabled: boolean;
  farewellImageConfig: WelcomeImageSettings;
}
