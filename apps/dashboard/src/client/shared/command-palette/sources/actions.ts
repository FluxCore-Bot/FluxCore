import type { TFunction } from "i18next";
import type { Command } from "../types";

export function actionCommands(opts: {
  guildId: string | undefined;
  t: TFunction;
  onRefreshGuild: () => void;
  onRefreshGuildList: () => void;
  inviteUrl: string | null;
}): Command[] {
  const { guildId, t, onRefreshGuild, onRefreshGuildList, inviteUrl } = opts;
  const cmds: Command[] = [];

  if (guildId) {
    cmds.push({
      id: "action:refreshGuild",
      group: "actions",
      title: t("palette.action.refreshGuild"),
      icon: "sync",
      onSelect: onRefreshGuild,
    });
    cmds.push({
      id: "action:backToServers",
      group: "actions",
      title: t("palette.action.backToServers"),
      icon: "arrow_back",
      to: "/",
    });
  }

  cmds.push({
    id: "action:refreshGuildList",
    group: "actions",
    title: t("palette.action.refreshGuildList"),
    icon: "sync",
    onSelect: onRefreshGuildList,
  });

  if (inviteUrl) {
    cmds.push({
      id: "action:addToServer",
      group: "actions",
      title: t("palette.action.addToServer"),
      icon: "add_circle",
      href: inviteUrl,
    });
  }

  cmds.push({
    id: "action:logout",
    group: "actions",
    title: t("palette.action.logout"),
    icon: "logout",
    href: "/auth/logout",
  });

  return cmds;
}
