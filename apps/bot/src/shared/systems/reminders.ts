import type { Client } from "discord.js";
import { getDueReminders } from "@fluxcore/systems";
import { infoEmbed, formatDuration, logger } from "@fluxcore/utils";

export { createReminder } from "@fluxcore/systems";

const POLL_INTERVAL = 15_000; // 15 seconds
let pollTimer: ReturnType<typeof setInterval> | null = null;

const BATCH_SIZE = 5;

async function sendReminder(
  client: Client,
  reminder: Awaited<ReturnType<typeof getDueReminders>>[number],
): Promise<number> {
  try {
    const user = await client.users.fetch(reminder.userId);
    const elapsed = reminder.expiresAt.getTime() - reminder.createdAt.getTime();
    const dm = await user.createDM();
    await dm.send({
      embeds: [
        infoEmbed("Reminder", reminder.message).setFooter({
          text: `Reminder set ${formatDuration(elapsed)} ago`,
        }),
      ],
    });
  } catch (error) {
    logger.warn(
      `Failed to send reminder ${reminder.id} to ${reminder.userId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return reminder.id;
}

async function processReminders(client: Client): Promise<void> {
  const due = await getDueReminders();

  if (due.length === 0) return;

  const completedIds: number[] = [];

  for (let i = 0; i < due.length; i += BATCH_SIZE) {
    const batch = due.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((r) => sendReminder(client, r)),
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        completedIds.push(result.value);
      }
    }
  }

  if (completedIds.length > 0) {
    try {
      const { getPrisma } = await import("@fluxcore/database");
      await getPrisma().reminder.deleteMany({
        where: { id: { in: completedIds } },
      });
    } catch (error) {
      logger.error(
        "Failed to batch-delete reminders",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}

export function startReminderPolling(client: Client): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    processReminders(client).catch((error) => {
      logger.error(
        "Reminder polling error",
        error instanceof Error ? error : new Error(String(error)),
      );
    });
  }, POLL_INTERVAL);
  logger.info("Reminder polling started");
}

export function stopReminderPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
