import { getPrisma } from "@fluxcore/database";
import type { RaidEvent, RaidEventType, RaidEventDetails } from "./types.js";
import { RAID_EVENT_PAGE_SIZE } from "./constants.js";

function rowToEvent(row: {
  id: number;
  guildId: string;
  eventType: string;
  details: string;
  triggeredAt: Date;
}): RaidEvent {
  return {
    id: row.id,
    guildId: row.guildId,
    eventType: row.eventType as RaidEventType,
    details: JSON.parse(row.details) as RaidEventDetails,
    triggeredAt: row.triggeredAt,
  };
}

export async function createRaidEvent(
  guildId: string,
  eventType: RaidEventType,
  details: RaidEventDetails,
): Promise<RaidEvent> {
  const prisma = getPrisma();
  const row = await prisma.raidEvent.create({
    data: {
      guildId,
      eventType,
      details: JSON.stringify(details),
    },
  });
  return rowToEvent(row);
}

export async function getRaidEvents(
  guildId: string,
  page: number = 1,
  limit: number = RAID_EVENT_PAGE_SIZE,
): Promise<{ events: RaidEvent[]; total: number }> {
  const prisma = getPrisma();

  const [rows, total] = await Promise.all([
    prisma.raidEvent.findMany({
      where: { guildId },
      orderBy: { triggeredAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.raidEvent.count({ where: { guildId } }),
  ]);

  return {
    events: rows.map(rowToEvent),
    total,
  };
}
