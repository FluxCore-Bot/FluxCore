-- CreateTable
CREATE TABLE "MusicGuildSettings" (
    "guildId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'open',
    "djRoleId" TEXT,
    "defaultVolume" INTEGER NOT NULL DEFAULT 50,
    "maxQueueSize" INTEGER NOT NULL DEFAULT 100,
    "autoDisconnectSecs" INTEGER NOT NULL DEFAULT 300,
    "twentyFourSeven" BOOLEAN NOT NULL DEFAULT false,
    "lastChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicGuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "MusicLibraryAlbum" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicLibraryAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicLibraryTrack" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "duration" INTEGER,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicLibraryTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MusicLibraryAlbum_guildId_name_key" ON "MusicLibraryAlbum"("guildId", "name");

-- CreateIndex
CREATE INDEX "MusicLibraryAlbum_guildId_idx" ON "MusicLibraryAlbum"("guildId");

-- CreateIndex
CREATE INDEX "MusicLibraryTrack_albumId_idx" ON "MusicLibraryTrack"("albumId");

-- AddForeignKey
ALTER TABLE "MusicLibraryTrack" ADD CONSTRAINT "MusicLibraryTrack_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "MusicLibraryAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
