-- CreateTable
CREATE TABLE "TempVoiceGuildConfig" (
    "guildId" TEXT NOT NULL,
    "hubChannelId" TEXT NOT NULL,
    "categoryId" TEXT,
    "nameTemplate" TEXT NOT NULL DEFAULT '{user}''s Channel',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempVoiceGuildConfig_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "TempVoiceUserSettings" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelName" TEXT,
    "userLimit" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isTextClosed" BOOLEAN NOT NULL DEFAULT false,
    "bannedUserIds" TEXT NOT NULL DEFAULT '[]',
    "hiddenFromUserIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempVoiceUserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TempVoiceUserSettings_guildId_userId_key" ON "TempVoiceUserSettings"("guildId", "userId");
