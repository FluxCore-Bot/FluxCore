import type { PanelType, PanelMode } from "./types.js";

export const MAX_ROLES_PER_PANEL = 25;

export const VALID_PANEL_TYPES: PanelType[] = ["reaction", "button", "dropdown"];

export const VALID_PANEL_MODES: PanelMode[] = ["toggle", "unique", "verify"];

export const BUTTON_STYLES = {
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
} as const;
