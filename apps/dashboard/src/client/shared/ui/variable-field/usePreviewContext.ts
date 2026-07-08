import { useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useGuilds } from "../../hooks/useGuilds";
import { buildRealData } from "./registry";
import type { PreviewRealData } from "./types";

export function usePreviewContext(guildId: string): PreviewRealData {
  const auth = useAuth();
  const guilds = useGuilds();
  return useMemo(() => {
    const user = auth.data
      ? { userId: auth.data.userId, username: auth.data.username, avatar: auth.data.avatar }
      : undefined;
    const guild = (guilds.data ?? []).find((g) => g.id === guildId);
    return buildRealData(guild, user);
  }, [auth.data, guilds.data, guildId]);
}
