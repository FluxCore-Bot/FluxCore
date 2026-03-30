import { getPrisma } from "@fluxcore/database";
import type { WelcomeConfig, EmbedConfig, WelcomeImageSettings } from "./types.js";
import {
  DEFAULT_WELCOME_IMAGE_SETTINGS,
  DEFAULT_FAREWELL_IMAGE_SETTINGS,
} from "./image/constants.js";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Use Record to accept Prisma row without tight coupling to generated types
function rowToConfig(row: Record<string, unknown>): WelcomeConfig {
  return {
    guildId: row.guildId as string,
    welcomeEnabled: row.welcomeEnabled as boolean,
    welcomeChannelId: (row.welcomeChannelId as string | null) ?? null,
    welcomeMessage: parseJson<EmbedConfig>(row.welcomeMessage as string, {}),
    farewellEnabled: row.farewellEnabled as boolean,
    farewellChannelId: (row.farewellChannelId as string | null) ?? null,
    farewellMessage: parseJson<EmbedConfig>(row.farewellMessage as string, {}),
    dmEnabled: row.dmEnabled as boolean,
    dmMessage: parseJson<EmbedConfig>(row.dmMessage as string, {}),
    autoRoleIds: parseJson<string[]>(row.autoRoleIds as string, []),
    welcomeImageEnabled: (row.welcomeImageEnabled as boolean) ?? false,
    welcomeImageConfig: parseJson<WelcomeImageSettings>(
      (row.welcomeImageConfig as string) ?? "{}",
      DEFAULT_WELCOME_IMAGE_SETTINGS,
    ),
    farewellImageEnabled: (row.farewellImageEnabled as boolean) ?? false,
    farewellImageConfig: parseJson<WelcomeImageSettings>(
      (row.farewellImageConfig as string) ?? "{}",
      DEFAULT_FAREWELL_IMAGE_SETTINGS,
    ),
  };
}

export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig | null> {
  const prisma = getPrisma();
  const row = await prisma.welcomeConfig.findUnique({ where: { guildId } });
  if (!row) return null;
  return rowToConfig(row as unknown as Record<string, unknown>);
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
  if (data.welcomeImageEnabled !== undefined) dbData.welcomeImageEnabled = data.welcomeImageEnabled;
  if (data.welcomeImageConfig !== undefined) dbData.welcomeImageConfig = JSON.stringify(data.welcomeImageConfig);
  if (data.farewellImageEnabled !== undefined) dbData.farewellImageEnabled = data.farewellImageEnabled;
  if (data.farewellImageConfig !== undefined) dbData.farewellImageConfig = JSON.stringify(data.farewellImageConfig);

  const row = await prisma.welcomeConfig.upsert({
    where: { guildId },
    create: { guildId, ...dbData },
    update: dbData,
  });

  return rowToConfig(row as unknown as Record<string, unknown>);
}
