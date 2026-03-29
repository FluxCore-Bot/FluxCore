export { isOnCooldown, setCooldown } from "./cooldown.js";
export { createReminder, getDueReminders, deleteReminder } from "./reminders.js";
export {
  loadMusicSettings,
  getMusicSettings,
  upsertMusicSettings,
  getAllMusicGuildIds,
  get247Guilds,
} from "./music/config.js";
export {
  getAlbums,
  getAlbumWithTracks,
  getAlbumById,
  addAlbum,
  removeAlbum,
  addTrack,
  removeTrack,
  getAlbumTracks,
  searchAlbums,
  searchTracks,
  getAlbumCount,
  getTrackCount,
  findTrackByUrl,
} from "./music/library.js";
export {
  MU_PREFIX,
  MusicButtonIds,
} from "./music/constants.js";

// Logging
export { getLogConfig, loadLogConfigs, upsertLogConfig, isIgnored } from "./logging/config.js";
export { createLogEntry, getLogEntries, cleanOldLogEntries } from "./logging/persistence.js";
export { sendLogEmbed } from "./logging/sender.js";
export { LOG_COLORS, LOG_CATEGORIES, EVENT_TYPES_BY_CATEGORY } from "./logging/constants.js";

// Warnings
export { createWarning, getWarnings, deleteWarning, deleteAllWarnings, getWarningCount } from "./warnings/persistence.js";
export { checkAndExecutePunishment } from "./warnings/escalation.js";
export { getWarnSettings, upsertWarnSettings, getPunishments, addPunishment, removePunishment } from "./warnings/config.js";

// Moderation
export { createModCase, getModCases, getModCaseById, updateModCase, deleteModCase, getModSettings, upsertModSettings } from "./moderation/persistence.js";
export { startTempbanScheduler, stopTempbanScheduler, checkExpiredTempbans } from "./moderation/scheduler.js";
export { dmOnPunishment } from "./moderation/dm.js";

// Role Panels
export { getRolePanels, getRolePanel, getRolePanelByName, getRolePanelByMessageId, createRolePanel, updateRolePanel, deleteRolePanel, updatePanelMessageId } from "./rolePanel/persistence.js";
export { buildButtonComponents, buildDropdownComponent, buildPanelEmbed } from "./rolePanel/builder.js";
export { handleRolePanelButton, handleRolePanelDropdown, handleRolePanelReaction } from "./rolePanel/handler.js";
export { MAX_ROLES_PER_PANEL, VALID_PANEL_TYPES, VALID_PANEL_MODES, BUTTON_STYLES } from "./rolePanel/constants.js";

// Giveaways
export { createGiveaway, getGiveaway, getActiveGiveaways, listGiveaways, setGiveawayMessageId, addEntrant, removeEntrant, endGiveaway, getDueGiveaways, getActiveGiveawayCount } from "./giveaways/persistence.js";
export { selectWinners, rerollWinners } from "./giveaways/winner.js";
export { buildGiveawayEmbed, buildEndedGiveawayEmbed, buildGiveawayButton } from "./giveaways/embed.js";
export { startGiveawayScheduler, stopGiveawayScheduler, processEndedGiveaways } from "./giveaways/scheduler.js";
export { GIVEAWAY_BUTTON_PREFIX, GIVEAWAY_CHECK_INTERVAL_MS, MAX_WINNERS, MAX_PRIZE_LENGTH, MAX_ACTIVE_GIVEAWAYS, GIVEAWAY_PAGE_SIZE } from "./giveaways/constants.js";

// Leveling
export { getLevelSettings, upsertLevelSettings, getLevelRewards, addLevelReward, removeLevelReward } from "./leveling/config.js";
export { getUserLevel, addXp, addVoiceXp, setXp, getLeaderboard, getUserRank } from "./leveling/persistence.js";
export { xpForLevel, totalXpForLevel, levelFromXp, applyMultipliers } from "./leveling/xp.js";
export { checkAndGrantRewards } from "./leveling/rewards.js";

// Scheduled Messages
export { getScheduledMessages, getScheduledMessageById, createScheduledMessage, updateScheduledMessage, deleteScheduledMessage, getDueMessages, markMessageExecuted } from "./scheduled-messages/persistence.js";
export { startScheduledMessageScheduler, stopScheduledMessageScheduler, processScheduledMessages } from "./scheduled-messages/scheduler.js";
export { parseCronExpression, validateCronExpression, getNextCronRun, describeCron } from "./scheduled-messages/cron.js";
export { SCHEDULER_CHECK_INTERVAL_MS, MAX_SCHEDULED_MESSAGES_PER_GUILD, COMMON_TIMEZONES } from "./scheduled-messages/constants.js";
// Custom Commands
export {
  getCustomCommands,
  getCustomCommandById,
  getCustomCommandCount,
  createCustomCommand,
  updateCustomCommand,
  deleteCustomCommand,
  invalidateCache as invalidateCustomCommandCache,
} from "./customCommands/persistence.js";
export { matchesTrigger, isAllowed } from "./customCommands/matcher.js";
export { executeCustomCommand } from "./customCommands/executor.js";
export { replaceVariables, TEMPLATE_VARIABLES } from "./customCommands/variables.js";
export {
  MAX_COMMANDS_PER_GUILD,
  TRIGGER_TYPES,
  TRIGGER_TYPE_LABELS,
} from "./customCommands/constants.js";
// Anti-Raid
export { getAntiRaidConfig, upsertAntiRaidConfig, invalidateAntiRaidCache } from "./antiraid/config.js";
export { recordJoin, clearJoinTracker, recordNukeAction, clearNukeTracker, isLockdownActive, setLockdownState } from "./antiraid/tracker.js";
export { executeRaidAction, lockdownGuild, liftLockdown, quarantineExecutor } from "./antiraid/actions.js";
export { createRaidEvent, getRaidEvents } from "./antiraid/persistence.js";
// Tickets
export { getTicketSettings, upsertTicketSettings, incrementTicketCounter } from "./tickets/config.js";
export {
  createTicket, getTicketByChannel, getTicketById, getTickets, getOpenTicketCount,
  updateTicket, closeTicket, claimTicket, getInactiveTickets,
  getTicketPanels, getTicketPanel, createTicketPanel, updateTicketPanel,
  deleteTicketPanel, updatePanelMessageId,
} from "./tickets/persistence.js";
export { buildTranscriptHtml } from "./tickets/transcript.js";
export { buildPanelComponents, buildPanelEmbed, buildTicketWelcomeEmbed, buildTicketActionRow } from "./tickets/builder.js";
export { TICKET_BUTTON_PREFIX, TICKET_CLAIM_ID, TICKET_CLOSE_ID, MAX_FORM_FIELDS, MAX_CATEGORIES, TICKETS_PAGE_SIZE } from "./tickets/constants.js";

// Suggestions
export { getSuggestionSettings, upsertSuggestionSettings } from "./suggestions/config.js";
export { createSuggestion, getSuggestion, getSuggestions, updateSuggestionStatus, updateSuggestionMessageId, updateSuggestionVotes, deleteSuggestion } from "./suggestions/persistence.js";
export { SUGGESTIONS_PAGE_SIZE, VALID_STATUSES, STATUS_COLORS, STATUS_LABELS, MAX_SUGGESTION_LENGTH, DEFAULT_SETTINGS as DEFAULT_SUGGESTION_SETTINGS } from "./suggestions/constants.js";

// Starboard
export { getStarboardSettings, upsertStarboardSettings } from "./starboard/config.js";
export { getStarboardEntry, upsertStarboardEntry, updateStarboardMessageId, updateStarCount, deleteStarboardEntry, getStarboardEntries } from "./starboard/persistence.js";
export { handleStarboardReaction } from "./starboard/handler.js";
export { DEFAULT_EMOJI, DEFAULT_THRESHOLD, STARBOARD_PAGE_SIZE } from "./starboard/constants.js";
