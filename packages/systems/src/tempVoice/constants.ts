export const TV_PREFIX = "tv_";

export const ButtonIds = {
  RENAME: `${TV_PREFIX}rename`,
  LIMIT: `${TV_PREFIX}limit`,
  LOCK: `${TV_PREFIX}lock`,
  UNLOCK: `${TV_PREFIX}unlock`,
  HIDE: `${TV_PREFIX}hide`,
  UNHIDE: `${TV_PREFIX}unhide`,
  CLOSE_TEXT: `${TV_PREFIX}close_text`,
  OPEN_TEXT: `${TV_PREFIX}open_text`,
  KICK: `${TV_PREFIX}kick`,
  INVITE: `${TV_PREFIX}invite`,
  CLAIM: `${TV_PREFIX}claim`,
  TRANSFER: `${TV_PREFIX}transfer`,
  BAN: `${TV_PREFIX}ban`,
  UNBAN: `${TV_PREFIX}unban`,
  HIDE_FROM: `${TV_PREFIX}hide_from`,
  UNHIDE_FROM: `${TV_PREFIX}unhide_from`,
  DELETE: `${TV_PREFIX}delete`,
  CONFIG: `${TV_PREFIX}config`,
} as const;

export const SelectIds = {
  KICK: `${TV_PREFIX}select_kick`,
  INVITE: `${TV_PREFIX}select_invite`,
  TRANSFER: `${TV_PREFIX}select_transfer`,
  BAN: `${TV_PREFIX}select_ban`,
  HIDE_FROM: `${TV_PREFIX}select_hide_from`,
  UNBAN: `${TV_PREFIX}select_unban`,
  UNHIDE_FROM: `${TV_PREFIX}select_unhide_from`,
} as const;

export const ModalIds = {
  RENAME: `${TV_PREFIX}modal_rename`,
  LIMIT: `${TV_PREFIX}modal_limit`,
} as const;

export const InputIds = {
  CHANNEL_NAME: `${TV_PREFIX}input_name`,
  USER_LIMIT: `${TV_PREFIX}input_limit`,
} as const;

export const DEFAULT_NAME_TEMPLATE = "{user}'s Channel";

export const MAX_TEMPVOICE_CONFIGS_PER_GUILD = 10;
