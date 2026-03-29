export type TriggerType = "command" | "keyword" | "startsWith" | "regex";

export interface CommandResponse {
  type: "text" | "embed";
  content?: string;
  embed?: {
    title?: string;
    description?: string;
    color?: number;
    footer?: string;
    thumbnail?: string;
    image?: string;
  };
}

export interface CommandAction {
  type: "addRole" | "removeRole";
  roleId: string;
}

export interface CustomCommand {
  id: number;
  guildId: string;
  name: string;
  triggerType: TriggerType;
  response: CommandResponse;
  actions: CommandAction[];
  enabled: boolean;
  cooldown: number;
  allowedRoles: string[];
  allowedChannels: string[];
  deletesTrigger: boolean;
  dmResponse: boolean;
  createdBy: string;
  createdAt: Date;
}
