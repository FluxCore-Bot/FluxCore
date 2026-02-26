-- CreateTable
CREATE TABLE "ActionRule" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "eventType" TEXT NOT NULL,
    "actions" TEXT NOT NULL DEFAULT '[]',
    "conditions" TEXT NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "ruleName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionGuildSettings" (
    "guildId" TEXT NOT NULL,
    "maxRules" INTEGER NOT NULL DEFAULT 25,
    "globalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "logChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionGuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateIndex
CREATE INDEX "ActionRule_guildId_eventType_idx" ON "ActionRule"("guildId", "eventType");

-- CreateIndex
CREATE INDEX "ActionRule_guildId_enabled_idx" ON "ActionRule"("guildId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ActionRule_guildId_name_key" ON "ActionRule"("guildId", "name");

-- CreateIndex
CREATE INDEX "ActionLog_guildId_executedAt_idx" ON "ActionLog"("guildId", "executedAt");

-- CreateIndex
CREATE INDEX "ActionLog_ruleId_idx" ON "ActionLog"("ruleId");
