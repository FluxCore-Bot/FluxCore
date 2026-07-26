import type { TFunction } from "i18next";
import { navItems } from "../../lib/navigation";
import type { Command } from "../types";

export function pageCommands(opts: {
  guildId: string | undefined;
  t: TFunction;
  can: (permission: string) => boolean;
}): Command[] {
  const { guildId, t, can } = opts;
  if (!guildId) return [];

  return navItems
    .filter((item) => !item.permission || can(item.permission))
    .map((item) => ({
      id: `page:${item.path}`,
      group: "pages" as const,
      title: t(item.i18nKey),
      icon: item.icon,
      keywords: item.keywordsI18nKey ? t(item.keywordsI18nKey) : undefined,
      to: item.path,
      params: { guildId },
    }));
}
