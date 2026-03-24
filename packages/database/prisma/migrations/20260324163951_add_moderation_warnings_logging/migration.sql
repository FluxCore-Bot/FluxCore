-- CreateTable
CREATE TABLE "LogGuildConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ignoredChannels" TEXT NOT NULL DEFAULT '[]',
    "ignoredRoles" TEXT NOT NULL DEFAULT '[]',
    "enabledEvents" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "LogGuildConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "targetId" TEXT,
    "executorId" TEXT,
    "content" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warning" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarnPunishment" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "duration" INTEGER,

    CONSTRAINT "WarnPunishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarnGuildSettings" (
    "guildId" TEXT NOT NULL,
    "dmOnWarn" BOOLEAN NOT NULL DEFAULT true,
    "reasonRequired" BOOLEAN NOT NULL DEFAULT false,
    "maxWarnings" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WarnGuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "ModCase" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModGuildSettings" (
    "guildId" TEXT NOT NULL,
    "dmOnPunishment" BOOLEAN NOT NULL DEFAULT true,
    "modLogChannelId" TEXT,

    CONSTRAINT "ModGuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateIndex
CREATE INDEX "LogGuildConfig_guildId_idx" ON "LogGuildConfig"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "LogGuildConfig_guildId_category_key" ON "LogGuildConfig"("guildId", "category");

-- CreateIndex
CREATE INDEX "LogEntry_guildId_category_createdAt_idx" ON "LogEntry"("guildId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "LogEntry_guildId_eventType_idx" ON "LogEntry"("guildId", "eventType");

-- CreateIndex
CREATE INDEX "LogEntry_guildId_targetId_idx" ON "LogEntry"("guildId", "targetId");

-- CreateIndex
CREATE INDEX "LogEntry_createdAt_idx" ON "LogEntry"("createdAt");

-- CreateIndex
CREATE INDEX "Warning_guildId_userId_idx" ON "Warning"("guildId", "userId");

-- CreateIndex
CREATE INDEX "Warning_guildId_createdAt_idx" ON "Warning"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "WarnPunishment_guildId_idx" ON "WarnPunishment"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "WarnPunishment_guildId_threshold_key" ON "WarnPunishment"("guildId", "threshold");

-- CreateIndex
CREATE INDEX "ModCase_guildId_targetId_idx" ON "ModCase"("guildId", "targetId");

-- CreateIndex
CREATE INDEX "ModCase_guildId_createdAt_idx" ON "ModCase"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "ModCase_guildId_action_idx" ON "ModCase"("guildId", "action");

-- CreateIndex
CREATE INDEX "ModCase_expiresAt_active_idx" ON "ModCase"("expiresAt", "active");
