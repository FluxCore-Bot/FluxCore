export type RealDataKey =
  | "userMention" | "userName" | "userTag" | "userId" | "userAvatar"
  | "serverName" | "serverId" | "serverIcon" | "memberCount";

export type VariableGroup =
  | "user" | "server" | "channel" | "role" | "message" | "event" | "misc";

export interface VariableDescriptor {
  token: string;
  labelKey?: string;
  description?: string;
  example: string;
  group: VariableGroup;
  realKey?: RealDataKey;
}

export interface Segment {
  type: "text" | "var";
  value: string;
  known: boolean;
}

export interface UnknownToken {
  token: string;
  suggestion: string | null;
}

export interface PreviewRealData {
  userMention: string;
  userName: string;
  userTag: string;
  userId: string;
  userAvatar: string;
  serverName: string;
  serverId: string;
  serverIcon: string;
  memberCount: string;
}
