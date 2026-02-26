import type { Client } from "discord.js";
import { getDueReminders, deleteReminder } from "@fluxcore/systems";
import { infoEmbed, formatDuration, logger } from "@fluxcore/utils";

export { createReminder } from "@fluxcore/systems";

const POLL_INTERVAL = 15_000; // 15 seconds
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function processReminders(client: Client): Promise<void> {
  const due = await getDueReminders();

  if (due.length === 0) return;

  for (const reminder of due) {
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

    try {
      await deleteReminder(reminder.id);
    } catch (error) {
      logger.error(
        `Failed to delete reminder ${reminder.id}`,
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
