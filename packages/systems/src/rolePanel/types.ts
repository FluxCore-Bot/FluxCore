export type PanelType = "reaction" | "button" | "dropdown";
export type PanelMode = "toggle" | "unique" | "verify";

export interface RolePanelEntry {
  roleId: string;
  label: string;
  emoji?: string;
  description?: string;
  style?: number; // ButtonStyle: 1=Primary, 2=Secondary, 3=Success, 4=Danger
}

export interface RolePanel {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  name: string;
  type: PanelType;
  mode: PanelMode;
  embed: string;
  roles: RolePanelEntry[];
  maxRoles: number | null;
  minRoles: number | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRolePanelInput {
  guildId: string;
  channelId: string;
  name: string;
  type: PanelType;
  mode?: PanelMode;
  embed?: string;
  roles?: RolePanelEntry[];
  maxRoles?: number;
  minRoles?: number;
  createdBy: string;
}

export interface UpdateRolePanelInput {
  name?: string;
  channelId?: string;
  type?: PanelType;
  mode?: PanelMode;
  embed?: string;
  roles?: RolePanelEntry[];
  maxRoles?: number | null;
  minRoles?: number | null;
}
