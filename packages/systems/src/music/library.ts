import { getPrisma } from "@fluxcore/database";
import type { MusicLibraryAlbum, MusicLibraryTrack } from "./types.js";

export async function getAlbums(guildId: string): Promise<MusicLibraryAlbum[]> {
  const prisma = getPrisma();
  return prisma.musicLibraryAlbum.findMany({
    where: { guildId },
    orderBy: { name: "asc" },
  });
}

export async function getAlbumWithTracks(
  guildId: string,
  albumName: string,
): Promise<(MusicLibraryAlbum & { tracks: MusicLibraryTrack[] }) | null> {
  const prisma = getPrisma();
  return prisma.musicLibraryAlbum.findUnique({
    where: { guildId_name: { guildId, name: albumName } },
    include: { tracks: { orderBy: { title: "asc" } } },
  });
}

export async function getAlbumById(
  albumId: number,
): Promise<MusicLibraryAlbum | null> {
  const prisma = getPrisma();
  return prisma.musicLibraryAlbum.findUnique({ where: { id: albumId } });
}

export async function addAlbum(
  guildId: string,
  name: string,
  addedBy: string,
): Promise<MusicLibraryAlbum> {
  const prisma = getPrisma();
  return prisma.musicLibraryAlbum.create({
    data: { guildId, name, addedBy },
  });
}

export async function removeAlbum(albumId: number): Promise<void> {
  const prisma = getPrisma();
  await prisma.musicLibraryAlbum.delete({ where: { id: albumId } });
}

export async function addTrack(
  albumId: number,
  title: string,
  sourceUrl: string,
  duration: number | null,
  addedBy: string,
): Promise<MusicLibraryTrack> {
  const prisma = getPrisma();
  return prisma.musicLibraryTrack.create({
    data: { albumId, title, sourceUrl, duration, addedBy },
  });
}

export async function removeTrack(trackId: number): Promise<void> {
  const prisma = getPrisma();
  await prisma.musicLibraryTrack.delete({ where: { id: trackId } });
}

export async function getAlbumTracks(albumId: number): Promise<MusicLibraryTrack[]> {
  const prisma = getPrisma();
  return prisma.musicLibraryTrack.findMany({
    where: { albumId },
    orderBy: { title: "asc" },
  });
}

export async function searchAlbums(
  guildId: string,
  query: string,
): Promise<MusicLibraryAlbum[]> {
  const prisma = getPrisma();
  return prisma.musicLibraryAlbum.findMany({
    where: {
      guildId,
      name: { contains: query, mode: "insensitive" },
    },
    take: 25,
    orderBy: { name: "asc" },
  });
}

export async function searchTracks(
  albumId: number,
  query: string,
): Promise<MusicLibraryTrack[]> {
  const prisma = getPrisma();
  return prisma.musicLibraryTrack.findMany({
    where: {
      albumId,
      title: { contains: query, mode: "insensitive" },
    },
    take: 25,
    orderBy: { title: "asc" },
  });
}

export async function getAlbumCount(guildId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.musicLibraryAlbum.count({ where: { guildId } });
}

export async function getTrackCount(albumId: number): Promise<number> {
  const prisma = getPrisma();
  return prisma.musicLibraryTrack.count({ where: { albumId } });
}

export async function findTrackByUrl(
  guildId: string,
  sourceUrl: string,
): Promise<MusicLibraryTrack | null> {
  const prisma = getPrisma();
  return prisma.musicLibraryTrack.findFirst({
    where: {
      sourceUrl,
      album: { guildId },
    },
  });
}
