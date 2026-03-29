import { getPrisma } from "@fluxcore/database";
import type { SuggestionGuildSettings } from "./types.js";
import { DEFAULT_SETTINGS } from "./constants.js";

export async function getSuggestionSettings(guildId: string): Promise<SuggestionGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.suggestionGuildSettings.findUnique({ where: { guildId } });
  if (!row) return { guildId, ...DEFAULT_SETTINGS };
  return row;
}

export async function upsertSuggestionSettings(
  guildId: string,
  data: Partial<Omit<SuggestionGuildSettings, "guildId">>,
): Promise<SuggestionGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.suggestionGuildSettings.upsert({
    where: { guildId },
    create: { guildId, ...data },
    update: data,
  });
  return row;
}
