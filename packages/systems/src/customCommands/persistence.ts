import { getPrisma } from "@fluxcore/database";
import type { CustomCommand, CommandResponse, CommandAction } from "./types.js";

function rowToCommand(row: {
  id: number;
  guildId: string;
  name: string;
  triggerType: string;
  response: string;
  actions: string;
  enabled: boolean;
  cooldown: number;
  allowedRoles: string;
  allowedChannels: string;
  deletesTrigger: boolean;
  dmResponse: boolean;
  createdBy: string;
  createdAt: Date;
}): CustomCommand {
  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    triggerType: row.triggerType as CustomCommand["triggerType"],
    response: JSON.parse(row.response) as CommandResponse,
    actions: JSON.parse(row.actions) as CommandAction[],
    enabled: row.enabled,
    cooldown: row.cooldown,
    allowedRoles: JSON.parse(row.allowedRoles) as string[],
    allowedChannels: JSON.parse(row.allowedChannels) as string[],
    deletesTrigger: row.deletesTrigger,
    dmResponse: row.dmResponse,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

// Simple in-memory cache per guild
const cache = new Map<string, { commands: CustomCommand[]; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

export async function getCustomCommands(guildId: string): Promise<CustomCommand[]> {
  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.commands;
  }

  const prisma = getPrisma();
  const rows = await prisma.customCommand.findMany({
    where: { guildId },
    orderBy: { createdAt: "asc" },
  });

  const commands = rows.map(rowToCommand);
  cache.set(guildId, { commands, fetchedAt: Date.now() });
  return commands;
}

export function invalidateCache(guildId: string): void {
  cache.delete(guildId);
}

export async function getCustomCommandById(
  id: number,
  guildId: string,
): Promise<CustomCommand | null> {
  const prisma = getPrisma();
  const row = await prisma.customCommand.findFirst({
    where: { id, guildId },
  });
  return row ? rowToCommand(row) : null;
}

export async function getCustomCommandCount(guildId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.customCommand.count({ where: { guildId } });
}

export interface CreateCustomCommandData {
  guildId: string;
  name: string;
  triggerType: string;
  response?: CommandResponse;
  actions?: CommandAction[];
  enabled?: boolean;
  cooldown?: number;
  allowedRoles?: string[];
  allowedChannels?: string[];
  deletesTrigger?: boolean;
  dmResponse?: boolean;
  createdBy: string;
}

export async function createCustomCommand(
  data: CreateCustomCommandData,
): Promise<CustomCommand> {
  const prisma = getPrisma();

  const row = await prisma.customCommand.create({
    data: {
      guildId: data.guildId,
      name: data.name,
      triggerType: data.triggerType,
      response: JSON.stringify(data.response ?? { type: "text", content: "" }),
      actions: JSON.stringify(data.actions ?? []),
      enabled: data.enabled ?? true,
      cooldown: data.cooldown ?? 0,
      allowedRoles: JSON.stringify(data.allowedRoles ?? []),
      allowedChannels: JSON.stringify(data.allowedChannels ?? []),
      deletesTrigger: data.deletesTrigger ?? false,
      dmResponse: data.dmResponse ?? false,
      createdBy: data.createdBy,
    },
  });

  invalidateCache(data.guildId);
  return rowToCommand(row);
}

export interface UpdateCustomCommandData {
  name?: string;
  triggerType?: string;
  response?: CommandResponse;
  actions?: CommandAction[];
  enabled?: boolean;
  cooldown?: number;
  allowedRoles?: string[];
  allowedChannels?: string[];
  deletesTrigger?: boolean;
  dmResponse?: boolean;
}

export async function updateCustomCommand(
  id: number,
  guildId: string,
  data: UpdateCustomCommandData,
): Promise<CustomCommand | null> {
  const prisma = getPrisma();

  // Build the update object, converting JSON fields
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.triggerType !== undefined) update.triggerType = data.triggerType;
  if (data.response !== undefined) update.response = JSON.stringify(data.response);
  if (data.actions !== undefined) update.actions = JSON.stringify(data.actions);
  if (data.enabled !== undefined) update.enabled = data.enabled;
  if (data.cooldown !== undefined) update.cooldown = data.cooldown;
  if (data.allowedRoles !== undefined) update.allowedRoles = JSON.stringify(data.allowedRoles);
  if (data.allowedChannels !== undefined) update.allowedChannels = JSON.stringify(data.allowedChannels);
  if (data.deletesTrigger !== undefined) update.deletesTrigger = data.deletesTrigger;
  if (data.dmResponse !== undefined) update.dmResponse = data.dmResponse;

  try {
    const row = await prisma.customCommand.updateMany({
      where: { id, guildId },
      data: update,
    });

    if (row.count === 0) return null;

    invalidateCache(guildId);
    return getCustomCommandById(id, guildId);
  } catch {
    return null;
  }
}

export async function deleteCustomCommand(
  id: number,
  guildId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const result = await prisma.customCommand.deleteMany({
    where: { id, guildId },
  });
  if (result.count > 0) {
    invalidateCache(guildId);
    return true;
  }
  return false;
}
