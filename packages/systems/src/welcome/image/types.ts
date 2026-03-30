// ── Storage Adapter Interface ──

export interface StorageAdapter {
  /** Upload a file and return its storage key */
  upload(key: string, buffer: Buffer, contentType?: string): Promise<string>;
  /** Delete a file by key */
  delete(key: string): Promise<void>;
  /** Get file contents by key */
  get(key: string): Promise<Buffer>;
  /** Check if a file exists */
  exists(key: string): Promise<boolean>;
  /** Get a URL/path for serving the file */
  getUrl(key: string): string;
}

// ── Template Layout ──

export interface TemplateDecoration {
  type: "line" | "rect" | "gradient-bar" | "border" | "corner-accents" | "glow";
  /** Properties vary by decoration type */
  props: Record<string, number | string>;
}

export interface TemplateLayout {
  name: string;
  displayName: string;
  description: string;
  canvas: { width: number; height: number };
  avatar: {
    x: number;
    y: number;
    size: number;
  };
  title: {
    x: number;
    y: number;
    align: "left" | "center" | "right";
    maxWidth: number;
    defaultSize: number;
  };
  subtitle: {
    x: number;
    y: number;
    align: "left" | "center" | "right";
    maxWidth: number;
    defaultSize: number;
  };
  decorations: TemplateDecoration[];
}

// ── Font Registry ──

export interface FontDefinition {
  name: string;
  displayName: string;
  category: "sans-serif" | "serif" | "display" | "monospace" | "rounded";
  file: string;
  weight: number;
}

// ── Image Settings (stored as JSON in DB) ──

export interface BackgroundSettings {
  type: "color" | "image" | "preset";
  color: string;
  imageKey?: string;
  preset?: string;
}

export interface OverlaySettings {
  enabled: boolean;
  color: string;
  opacity: number;
}

export interface AvatarSettings {
  shape: "circle" | "rounded" | "square";
  borderColor: string;
  borderWidth: number;
  glowEnabled: boolean;
  glowColor: string;
}

export interface TextSettings {
  font: string;
  color: string;
  size: number;
}

export interface SubtitleSettings extends TextSettings {
  text: string;
}

export interface WelcomeImageSettings {
  template: string;
  background: BackgroundSettings;
  overlay: OverlaySettings;
  avatar: AvatarSettings;
  title: TextSettings;
  subtitle: SubtitleSettings;
  accentColor: string;
  sendMode: "with" | "before" | "only";
}

// ── Renderer Input ──

export interface RenderInput {
  settings: WelcomeImageSettings;
  member: {
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  guild: {
    name: string;
    iconUrl?: string;
    memberCount: number;
  };
}

// ── Farewell-specific defaults ──

export const farewellImageSettingsDefaults: Partial<WelcomeImageSettings> = {
  subtitle: {
    font: "Inter",
    color: "#6b7280",
    size: 20,
    text: "Goodbye, {user.name}!",
  },
  accentColor: "#6b7280",
};
