import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";

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

// ── Welcome Image Settings ──

export interface WelcomeImageSettings {
  template: string;
  background: {
    type: "color" | "image" | "preset";
    color: string;
    imageKey?: string;
    preset?: string;
  };
  overlay: {
    enabled: boolean;
    color: string;
    opacity: number;
  };
  avatar: {
    shape: "circle" | "rounded" | "square";
    borderColor: string;
    borderWidth: number;
    glowEnabled: boolean;
    glowColor: string;
  };
  title: {
    font: string;
    color: string;
    size: number;
  };
  subtitle: {
    font: string;
    color: string;
    size: number;
    text: string;
  };
  accentColor: string;
  sendMode: "with" | "before" | "only";
}

export interface TemplateInfo {
  name: string;
  displayName: string;
  description: string;
  canvas: { width: number; height: number };
}

export interface FontInfo {
  name: string;
  displayName: string;
  category: string;
  file: string;
  weight: number;
}

// ── Config Data ──

export interface WelcomeConfigData {
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

// ── Hooks ──

export function useWelcomeConfig(guildId: string) {
  return useQuery<WelcomeConfigData>({
    queryKey: ["guilds", guildId, "welcome"],
    queryFn: async () => {
      return apiFetch<WelcomeConfigData>(`/api/guilds/${guildId}/welcome`);
    },
  });
}

export function useUpdateWelcomeConfig(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<WelcomeConfigData, "guildId">>) => {
      return apiFetch<WelcomeConfigData>(`/api/guilds/${guildId}/welcome`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "welcome"],
      });
    },
  });
}

export function useTestWelcome(guildId: string) {
  return useMutation({
    mutationFn: async () => {
      return apiFetch<{ success: boolean; channelId: string }>(
        `/api/guilds/${guildId}/welcome/test`,
        { method: "POST" },
      );
    },
  });
}

export function useWelcomeTemplates() {
  return useQuery<{ templates: TemplateInfo[] }>({
    queryKey: ["welcome", "templates"],
    queryFn: () => apiFetch("/api/welcome/templates"),
    staleTime: Infinity, // Templates don't change at runtime
  });
}

export function useWelcomeFonts() {
  return useQuery<{ fonts: FontInfo[] }>({
    queryKey: ["welcome", "fonts"],
    queryFn: () => apiFetch("/api/welcome/fonts"),
    staleTime: Infinity,
  });
}

export function useWelcomePresets() {
  return useQuery<{ backgrounds: string[] }>({
    queryKey: ["welcome", "presets"],
    queryFn: () => apiFetch("/api/welcome/presets"),
    staleTime: Infinity,
  });
}

export function useWelcomeImagePreview(guildId: string) {
  return useMutation({
    mutationFn: async (params: { settings: WelcomeImageSettings; type?: "welcome" | "farewell" }) => {
      const res = await fetch(`/api/guilds/${guildId}/welcome/image/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("Failed to generate preview");
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
  });
}

export function useUploadBackground(guildId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""),
      );
      return apiFetch<{ key: string }>(
        `/api/guilds/${guildId}/welcome/image/background`,
        {
          method: "POST",
          body: JSON.stringify({ data: base64, contentType: file.type }),
        },
      );
    },
  });
}

export function useDeleteBackground(guildId: string) {
  return useMutation({
    mutationFn: async (key: string) => {
      return apiFetch<{ success: boolean }>(
        `/api/guilds/${guildId}/welcome/image/background`,
        { method: "DELETE", body: JSON.stringify({ key }) },
      );
    },
  });
}
