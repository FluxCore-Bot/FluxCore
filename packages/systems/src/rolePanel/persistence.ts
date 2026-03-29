import { getPrisma } from "@fluxcore/database";
import type { RolePanel, RolePanelEntry, CreateRolePanelInput, UpdateRolePanelInput } from "./types.js";

function parseRoles(rolesJson: string): RolePanelEntry[] {
  try {
    const parsed: unknown = JSON.parse(rolesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed as RolePanelEntry[];
  } catch {
    return [];
  }
}

function toRolePanel(row: {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  name: string;
  type: string;
  mode: string;
  embed: string;
  roles: string;
  maxRoles: number | null;
  minRoles: number | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): RolePanel {
  return {
    ...row,
    type: row.type as RolePanel["type"],
    mode: row.mode as RolePanel["mode"],
    roles: parseRoles(row.roles),
  };
}

export async function getRolePanels(guildId: string): Promise<RolePanel[]> {
  const prisma = getPrisma();
  const rows = await prisma.rolePanel.findMany({
    where: { guildId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRolePanel);
}

export async function getRolePanel(id: number): Promise<RolePanel | null> {
  const prisma = getPrisma();
  const row = await prisma.rolePanel.findUnique({ where: { id } });
  return row ? toRolePanel(row) : null;
}

export async function getRolePanelByName(guildId: string, name: string): Promise<RolePanel | null> {
  const prisma = getPrisma();
  const row = await prisma.rolePanel.findFirst({
    where: { guildId, name },
  });
  return row ? toRolePanel(row) : null;
}

export async function getRolePanelByMessageId(guildId: string, messageId: string): Promise<RolePanel | null> {
  const prisma = getPrisma();
  const row = await prisma.rolePanel.findUnique({
    where: { guildId_messageId: { guildId, messageId } },
  });
  return row ? toRolePanel(row) : null;
}

export async function createRolePanel(input: CreateRolePanelInput): Promise<RolePanel> {
  const prisma = getPrisma();
  const row = await prisma.rolePanel.create({
    data: {
      guildId: input.guildId,
      channelId: input.channelId,
      name: input.name,
      type: input.type,
      mode: input.mode ?? "toggle",
      embed: input.embed ?? "{}",
      roles: JSON.stringify(input.roles ?? []),
      maxRoles: input.maxRoles ?? null,
      minRoles: input.minRoles ?? null,
      createdBy: input.createdBy,
    },
  });
  return toRolePanel(row);
}

export async function updateRolePanel(
  id: number,
  guildId: string,
  data: UpdateRolePanelInput,
): Promise<RolePanel | null> {
  const prisma = getPrisma();

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.channelId !== undefined) updateData.channelId = data.channelId;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.mode !== undefined) updateData.mode = data.mode;
  if (data.embed !== undefined) updateData.embed = data.embed;
  if (data.roles !== undefined) updateData.roles = JSON.stringify(data.roles);
  if (data.maxRoles !== undefined) updateData.maxRoles = data.maxRoles;
  if (data.minRoles !== undefined) updateData.minRoles = data.minRoles;

  const row = await prisma.rolePanel.updateMany({
    where: { id, guildId },
    data: updateData,
  });

  if (row.count === 0) return null;
  return getRolePanel(id);
}

export async function deleteRolePanel(id: number, guildId: string): Promise<boolean> {
  const prisma = getPrisma();
  const result = await prisma.rolePanel.deleteMany({
    where: { id, guildId },
  });
  return result.count > 0;
}

export async function updatePanelMessageId(id: number, messageId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.rolePanel.update({
    where: { id },
    data: { messageId },
  });
}
