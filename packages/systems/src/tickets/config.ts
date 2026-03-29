import { getPrisma } from "@fluxcore/database";
import type { TicketGuildSettings } from "./types.js";
import { DEFAULT_SETTINGS } from "./constants.js";

function rowToSettings(row: {
  guildId: string;
  staffRoleIds: string;
  transcriptChannelId: string | null;
  maxOpenPerUser: number;
  autoCloseHours: number;
  namingFormat: string;
  ticketCounter: number;
}): TicketGuildSettings {
  return {
    guildId: row.guildId,
    staffRoleIds: JSON.parse(row.staffRoleIds) as string[],
    transcriptChannelId: row.transcriptChannelId,
    maxOpenPerUser: row.maxOpenPerUser,
    autoCloseHours: row.autoCloseHours,
    namingFormat: row.namingFormat,
    ticketCounter: row.ticketCounter,
  };
}

export async function getTicketSettings(guildId: string): Promise<TicketGuildSettings> {
  const prisma = getPrisma();
  const row = await prisma.ticketGuildSettings.findUnique({ where: { guildId } });
  if (!row) return { guildId, ...DEFAULT_SETTINGS };
  return rowToSettings(row);
}

export async function upsertTicketSettings(
  guildId: string,
  data: Partial<Omit<TicketGuildSettings, "guildId" | "ticketCounter">>,
): Promise<TicketGuildSettings> {
  const prisma = getPrisma();

  const dbData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "staffRoleIds") {
      dbData[key] = JSON.stringify(value);
    } else {
      dbData[key] = value;
    }
  }

  const row = await prisma.ticketGuildSettings.upsert({
    where: { guildId },
    create: { guildId, ...dbData },
    update: dbData,
  });
  return rowToSettings(row);
}

export async function incrementTicketCounter(guildId: string): Promise<number> {
  const prisma = getPrisma();

  const row = await prisma.ticketGuildSettings.upsert({
    where: { guildId },
    create: { guildId, ticketCounter: 1 },
    update: { ticketCounter: { increment: 1 } },
  });
  return row.ticketCounter;
}
