import { useQuery } from "@tanstack/react-query";

interface BotInfo {
  clientId: string;
  inviteUrl: string;
}

export function useBotInfo() {
  return useQuery<BotInfo>({
    queryKey: ["bot-info"],
    queryFn: async () => {
      const res = await fetch("/api/bot-info");
      return res.json();
    },
    staleTime: Infinity,
  });
}
