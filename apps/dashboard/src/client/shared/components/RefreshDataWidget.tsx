import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useRefreshGuild } from "../hooks/useGuilds";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Icon } from "./Icon";

interface RefreshDataWidgetProps {
  guildId: string;
}

export function RefreshDataWidget({ guildId }: RefreshDataWidgetProps) {
  const { t } = useTranslation();
  const refresh = useRefreshGuild(guildId);

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: () => toast.success(t("header.refreshData")),
      onError: () => toast.error(t("actions.retry")),
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
          aria-label={t("header.refreshData")}
        >
          <Icon
            name="sync"
            size={18}
            className={refresh.isPending ? "animate-spin" : ""}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("header.refreshData")}</TooltipContent>
    </Tooltip>
  );
}
