export type MusicMode = "open" | "library";

export type LoopMode = "off" | "track" | "queue";

export interface MusicGuildSettings {
  guildId: string;
  mode: MusicMode;
  djRoleId: string | null;
  defaultVolume: number;
  maxQueueSize: number;
  autoDisconnectSecs: number;
  twentyFourSeven: boolean;
  lastChannelId: string | null;
}

export interface MusicLibraryAlbum {
  id: number;
  guildId: string;
  name: string;
  addedBy: string;
}

export interface MusicLibraryTrack {
  id: number;
  albumId: number;
  title: string;
  sourceUrl: string;
  duration: number | null;
  addedBy: string;
}

export interface QueueTrack {
  title: string;
  url: string;
  duration: number;
  requester: string;
  thumbnail: string | null;
}
