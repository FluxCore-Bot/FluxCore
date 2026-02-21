import type { Client } from "discord.js";
import type { Event } from "../types/index.js";
import { auditPermissions } from "../systems/permissionAudit.js";
import { logger } from "../utils/logger.js";

const event: Event<"ready"> = {
  name: "ready",
  once: true,
  execute(client: Client<true>) {
    logger.info(`Logged in as ${client.user.displayName}`);
    auditPermissions(client);
  },
};

export default event;
