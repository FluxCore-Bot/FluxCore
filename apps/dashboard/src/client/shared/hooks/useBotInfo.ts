import { useQuery } from "@tanstack/react-query";

interface BotInfo {
  clientId: string;
  inviteUrl: string;
  latency: number | null;
}

export function useBotInfo() {
  return useQuery<BotInfo>({
    queryKey: ["bot-info"],
    queryFn: async () => {
      const res = await fetch("/api/bot-info");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
