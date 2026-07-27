export interface NavItem {
  path: string;
  /** i18n key under the "nav" namespace (e.g. "overview" -> t("nav.overview")) */
  i18nKey: string;
  icon: string;
  permission?: string;
  /**
   * Optional i18n key holding extra search terms for the command palette, so a
   * page can be found by a word that is not in its label — e.g. Automation is
   * findable by "rules". Unused by the sidebar.
   */
  keywordsI18nKey?: string;
}

export const navItems: NavItem[] = [
  { path: "/guild/$guildId/overview", i18nKey: "nav.overview", icon: "dashboard" },
  { path: "/guild/$guildId/rules", i18nKey: "nav.automation", icon: "bolt", permission: "actions.rules.view", keywordsI18nKey: "palette.keywords.automation" },
  { path: "/guild/$guildId/tempvoice", i18nKey: "nav.tempvoice", icon: "settings_voice", permission: "tempvoice.config.view" },
  { path: "/guild/$guildId/welcome", i18nKey: "nav.welcome", icon: "waving_hand", permission: "welcome.config.view" },
  { path: "/guild/$guildId/moderation", i18nKey: "nav.moderation", icon: "shield", permission: "moderation.cases.view", keywordsI18nKey: "palette.keywords.moderation" },
  { path: "/guild/$guildId/warnings", i18nKey: "nav.warnings", icon: "warning", permission: "moderation.warnings.view" },
  { path: "/guild/$guildId/roles", i18nKey: "nav.rolePanels", icon: "badge", permission: "roles.panels.view" },
  { path: "/guild/$guildId/leveling", i18nKey: "nav.leveling", icon: "trending_up", permission: "leveling.leaderboard.view" },
  { path: "/guild/$guildId/scheduled", i18nKey: "nav.scheduled", icon: "schedule", permission: "scheduled.messages.view" },
  { path: "/guild/$guildId/commands", i18nKey: "nav.commands", icon: "terminal", permission: "commands.list.view" },
  { path: "/guild/$guildId/security", i18nKey: "nav.security", icon: "security", permission: "security.config.view" },
  { path: "/guild/$guildId/tickets", i18nKey: "nav.tickets", icon: "confirmation_number", permission: "tickets.list.view" },
  { path: "/guild/$guildId/giveaways", i18nKey: "nav.giveaways", icon: "celebration", permission: "giveaways.list.view" },
  { path: "/guild/$guildId/suggestions", i18nKey: "nav.suggestions", icon: "lightbulb", permission: "suggestions.list.view" },
  { path: "/guild/$guildId/starboard", i18nKey: "nav.starboard", icon: "star", permission: "starboard.entries.view" },
  { path: "/guild/$guildId/logs", i18nKey: "nav.logs", icon: "description", permission: "logging.entries.view" },
  { path: "/guild/$guildId/permissions", i18nKey: "nav.permissions", icon: "admin_panel_settings", permission: "dashboard.roles.view" },
  { path: "/guild/$guildId/settings", i18nKey: "nav.settings", icon: "tune", permission: "dashboard.settings.manage" },
];
