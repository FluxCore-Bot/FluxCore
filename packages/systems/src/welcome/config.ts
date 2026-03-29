import { getPrisma } from "@fluxcore/database";
import type { WelcomeConfig, EmbedConfig } from "./types.js";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToConfig(row: {
  guildId: string;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  farewellEnabled: boolean;
  farewellChannelId: string | null;
  farewellMessage: string;
  dmEnabled: boolean;
  dmMessage: string;
  autoRoleIds: string;
}): WelcomeConfig {
  return {
    guildId: row.guildId,
    welcomeEnabled: row.welcomeEnabled,
    welcomeChannelId: row.welcomeChannelId,
    welcomeMessage: parseJson<EmbedConfig>(row.welcomeMessage, {}),
    farewellEnabled: row.farewellEnabled,
    farewellChannelId: row.farewellChannelId,
    farewellMessage: parseJson<EmbedConfig>(row.farewellMessage, {}),
    dmEnabled: row.dmEnabled,
    dmMessage: parseJson<EmbedConfig>(row.dmMessage, {}),
    autoRoleIds: parseJson<string[]>(row.autoRoleIds, []),
  };
}

export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig | null> {
  const prisma = getPrisma();
  const row = await prisma.welcomeConfig.findUnique({ where: { guildId } });
  if (!row) return null;
  return rowToConfig(row);
}

export async function upsertWelcomeConfig(
  guildId: string,
  data: Partial<Omit<WelcomeConfig, "guildId">>,
): Promise<WelcomeConfig> {
  const prisma = getPrisma();

  const dbData: Record<string, unknown> = {};
  if (data.welcomeEnabled !== undefined) dbData.welcomeEnabled = data.welcomeEnabled;
  if (data.welcomeChannelId !== undefined) dbData.welcomeChannelId = data.welcomeChannelId;
  if (data.welcomeMessage !== undefined) dbData.welcomeMessage = JSON.stringify(data.welcomeMessage);
  if (data.farewellEnabled !== undefined) dbData.farewellEnabled = data.farewellEnabled;
  if (data.farewellChannelId !== undefined) dbData.farewellChannelId = data.farewellChannelId;
  if (data.farewellMessage !== undefined) dbData.farewellMessage = JSON.stringify(data.farewellMessage);
  if (data.dmEnabled !== undefined) dbData.dmEnabled = data.dmEnabled;
  if (data.dmMessage !== undefined) dbData.dmMessage = JSON.stringify(data.dmMessage);
  if (data.autoRoleIds !== undefined) dbData.autoRoleIds = JSON.stringify(data.autoRoleIds);

  const row = await prisma.welcomeConfig.upsert({
    where: { guildId },
    create: { guildId, ...dbData },
    update: dbData,
  });

  return rowToConfig(row);
}
