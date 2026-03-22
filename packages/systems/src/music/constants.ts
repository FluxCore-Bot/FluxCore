export const DEFAULT_VOLUME = 50;
export const MAX_QUEUE_SIZE_LIMIT = 500;
export const DEFAULT_AUTO_DISCONNECT_SECS = 300;
export const MAX_LIBRARY_ALBUMS_PER_GUILD = 50;
export const MAX_TRACKS_PER_ALBUM = 100;

export const DEFAULT_SEARCH_PREFIX = "ytsearch:";
export const MU_PREFIX = "mu_";

export const MusicButtonIds = {
  PAUSE_RESUME: `${MU_PREFIX}pause_resume`,
  SKIP: `${MU_PREFIX}skip`,
  STOP: `${MU_PREFIX}stop`,
  LOOP: `${MU_PREFIX}loop`,
  SHUFFLE: `${MU_PREFIX}shuffle`,
  VOL_DOWN: `${MU_PREFIX}vol_down`,
  VOL_UP: `${MU_PREFIX}vol_up`,
  QUEUE: `${MU_PREFIX}queue`,
} as const;
