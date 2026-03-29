-- CreateTable
CREATE TABLE "WelcomeConfig" (
    "guildId" TEXT NOT NULL,
    "welcomeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "welcomeChannelId" TEXT,
    "welcomeMessage" TEXT NOT NULL DEFAULT '{}',
    "farewellEnabled" BOOLEAN NOT NULL DEFAULT false,
    "farewellChannelId" TEXT,
    "farewellMessage" TEXT NOT NULL DEFAULT '{}',
    "dmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dmMessage" TEXT NOT NULL DEFAULT '{}',
    "autoRoleIds" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "WelcomeConfig_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "RolePanel" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'toggle',
    "embed" TEXT NOT NULL DEFAULT '{}',
    "roles" TEXT NOT NULL DEFAULT '[]',
    "maxRoles" INTEGER,
    "minRoles" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLevel" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "voiceMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastMessageXp" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelReward" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "LevelReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelGuildSettings" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "xpPerMessage" INTEGER NOT NULL DEFAULT 15,
    "xpCooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "voiceXpPerMinute" INTEGER NOT NULL DEFAULT 5,
    "voiceXpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "announceChannel" TEXT,
    "announceMessage" TEXT NOT NULL DEFAULT '{user} just reached **Level {level}**!',
    "announceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "noXpChannels" TEXT NOT NULL DEFAULT '[]',
    "noXpRoles" TEXT NOT NULL DEFAULT '[]',
    "xpMultipliers" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "LevelGuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateIndex
CREATE INDEX "RolePanel_guildId_idx" ON "RolePanel"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePanel_guildId_messageId_key" ON "RolePanel"("guildId", "messageId");

-- CreateIndex
CREATE INDEX "UserLevel_guildId_xp_idx" ON "UserLevel"("guildId", "xp");

-- CreateIndex
CREATE INDEX "UserLevel_guildId_level_idx" ON "UserLevel"("guildId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "UserLevel_guildId_userId_key" ON "UserLevel"("guildId", "userId");

-- CreateIndex
CREATE INDEX "LevelReward_guildId_idx" ON "LevelReward"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "LevelReward_guildId_level_roleId_key" ON "LevelReward"("guildId", "level", "roleId");
