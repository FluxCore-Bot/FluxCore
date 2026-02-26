import { getPrisma } from "@fluxcore/database";

export async function createReminder(
  userId: string,
  message: string,
  durationMs: number,
  channelId?: string,
  guildId?: string,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.reminder.create({
    data: {
      userId,
      message,
      channelId: channelId ?? null,
      guildId: guildId ?? null,
      expiresAt: new Date(Date.now() + durationMs),
    },
  });
}

export async function getDueReminders(limit: number = 50) {
  const prisma = getPrisma();
  return prisma.reminder.findMany({
    where: { expiresAt: { lte: new Date() } },
    take: limit,
  });
}

export async function deleteReminder(id: number): Promise<void> {
  const prisma = getPrisma();
  await prisma.reminder.delete({ where: { id } });
}
