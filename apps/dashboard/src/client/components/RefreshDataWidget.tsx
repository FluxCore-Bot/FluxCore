import { toast } from "sonner";
import { useRefreshGuild } from "../lib/hooks/useGuilds";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Icon } from "./Icon";

interface RefreshDataWidgetProps {
  guildId: string;
}

export function RefreshDataWidget({ guildId }: RefreshDataWidgetProps) {
  const refresh = useRefreshGuild(guildId);

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: () => toast.success("Data refreshed"),
      onError: () => toast.error("Refresh failed, try again later"),
    });
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={refresh.isPending}
        >
          <Icon
            name="sync"
            size={18}
            className={refresh.isPending ? "animate-spin" : ""}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Refresh Discord data</TooltipContent>
    </Tooltip>
  );
}
