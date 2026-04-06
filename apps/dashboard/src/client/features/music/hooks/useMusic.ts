import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";
import {
  MusicSettingsSchema,
  MusicAlbumListSchema,
  MusicTrackListSchema,
  type MusicSettings,
  type MusicSettingsFormData,
  type MusicAlbum,
  type MusicTrack,
} from "../../../shared/lib/schemas";

export function useMusicSettings(guildId: string) {
  return useQuery<MusicSettings>({
    queryKey: ["guilds", guildId, "music-settings"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/music/settings`,
      );
      return MusicSettingsSchema.parse(data);
    },
  });
}

export function useUpdateMusicSettings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<MusicSettingsFormData>) => {
      return apiFetch<MusicSettings>(
        `/api/guilds/${guildId}/music/settings`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "music-settings"],
      });
    },
  });
}

export function useMusicLibrary(guildId: string) {
  return useQuery<MusicAlbum[]>({
    queryKey: ["guilds", guildId, "music-library"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/music/library`,
      );
      return MusicAlbumListSchema.parse(data);
    },
  });
}

export function useCreateAlbum(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return apiFetch<MusicAlbum>(`/api/guilds/${guildId}/music/library`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "music-library"],
      });
    },
  });
}

export function useDeleteAlbum(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (albumId: number) => {
      await apiFetch(`/api/guilds/${guildId}/music/library/${albumId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "music-library"],
      });
    },
  });
}

export function useAlbumTracks(guildId: string, albumId: number | null) {
  return useQuery<MusicTrack[]>({
    queryKey: ["guilds", guildId, "music-library", albumId, "tracks"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/music/library/${albumId}/tracks`,
      );
      return MusicTrackListSchema.parse(data);
    },
    enabled: albumId !== null,
  });
}

export function useAddTrack(guildId: string, albumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; sourceUrl: string; duration?: number | null }) => {
      return apiFetch<MusicTrack>(
        `/api/guilds/${guildId}/music/library/${albumId}/tracks`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "music-library", albumId, "tracks"],
      });
    },
  });
}

export function useDeleteTrack(guildId: string, albumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (trackId: number) => {
      await apiFetch(
        `/api/guilds/${guildId}/music/library/${albumId}/tracks/${trackId}`,
        { method: "DELETE" },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "music-library", albumId, "tracks"],
      });
    },
  });
}
