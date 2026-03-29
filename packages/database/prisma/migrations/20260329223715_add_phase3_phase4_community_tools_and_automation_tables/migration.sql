-- CreateTable
CREATE TABLE "ScheduledMessage" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '{}',
    "cronExpr" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomCommand" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT '{}',
    "actions" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldown" INTEGER NOT NULL DEFAULT 0,
    "allowedRoles" TEXT NOT NULL DEFAULT '[]',
    "allowedChannels" TEXT NOT NULL DEFAULT '[]',
    "deletesTrigger" BOOLEAN NOT NULL DEFAULT false,
    "dmResponse" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntiRaidConfig" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "joinThreshold" INTEGER NOT NULL DEFAULT 10,
    "joinWindow" INTEGER NOT NULL DEFAULT 10,
    "joinAction" TEXT NOT NULL DEFAULT 'kick',
    "accountAgeMinDays" INTEGER NOT NULL DEFAULT 0,
    "accountAgeAction" TEXT NOT NULL DEFAULT 'kick',
    "antiNukeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "antiNukeThreshold" INTEGER NOT NULL DEFAULT 3,
    "lockdownOnRaid" BOOLEAN NOT NULL DEFAULT false,
    "whitelistedRoleIds" TEXT NOT NULL DEFAULT '[]',
    "logChannelId" TEXT,

    CONSTRAINT "AntiRaidConfig_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "RaidEvent" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPanel" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "name" TEXT NOT NULL,
    "embed" TEXT NOT NULL DEFAULT '{}',
    "categories" TEXT NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryName" TEXT,
    "panelId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "claimedBy" TEXT,
    "closeReason" TEXT,
    "formResponses" TEXT NOT NULL DEFAULT '{}',
    "transcriptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketGuildSettings" (
    "guildId" TEXT NOT NULL,
    "staffRoleIds" TEXT NOT NULL DEFAULT '[]',
    "transcriptChannelId" TEXT,
    "maxOpenPerUser" INTEGER NOT NULL DEFAULT 3,
    "autoCloseHours" INTEGER NOT NULL DEFAULT 0,
    "namingFormat" TEXT NOT NULL DEFAULT 'ticket-{number}',
    "ticketCounter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TicketGuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "hostId" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "winners" INTEGER NOT NULL DEFAULT 1,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "winnerIds" TEXT NOT NULL DEFAULT '[]',
    "entrantIds" TEXT NOT NULL DEFAULT '[]',
    "requiredRoleIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayCacheInvalidation" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayCacheInvalidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusReason" TEXT,
    "statusBy" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionGuildSettings" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channelId" TEXT,
    "reviewChannelId" TEXT,
    "dmOnStatusChange" BOOLEAN NOT NULL DEFAULT true,
    "autoThread" BOOLEAN NOT NULL DEFAULT false,
    "anonymousMode" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SuggestionGuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "StarboardEntry" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "originalMessageId" TEXT NOT NULL,
    "originalChannelId" TEXT NOT NULL,
    "starboardMessageId" TEXT,
    "authorId" TEXT NOT NULL,
    "starCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarboardGuildSettings" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channelId" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '⭐',
    "threshold" INTEGER NOT NULL DEFAULT 3,
    "selfStar" BOOLEAN NOT NULL DEFAULT false,
    "ignoredChannels" TEXT NOT NULL DEFAULT '[]',
    "nsfwHandling" TEXT NOT NULL DEFAULT 'ignore',

    CONSTRAINT "StarboardGuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateIndex
CREATE INDEX "ScheduledMessage_guildId_idx" ON "ScheduledMessage"("guildId");

-- CreateIndex
CREATE INDEX "ScheduledMessage_nextRunAt_enabled_idx" ON "ScheduledMessage"("nextRunAt", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledMessage_guildId_name_key" ON "ScheduledMessage"("guildId", "name");

-- CreateIndex
CREATE INDEX "CustomCommand_guildId_enabled_idx" ON "CustomCommand"("guildId", "enabled");

-- CreateIndex
CREATE INDEX "CustomCommand_guildId_triggerType_idx" ON "CustomCommand"("guildId", "triggerType");

-- CreateIndex
CREATE UNIQUE INDEX "CustomCommand_guildId_name_key" ON "CustomCommand"("guildId", "name");

-- CreateIndex
CREATE INDEX "RaidEvent_guildId_triggeredAt_idx" ON "RaidEvent"("guildId", "triggeredAt");

-- CreateIndex
CREATE INDEX "TicketPanel_guildId_idx" ON "TicketPanel"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");

-- CreateIndex
CREATE INDEX "Ticket_guildId_userId_idx" ON "Ticket"("guildId", "userId");

-- CreateIndex
CREATE INDEX "Ticket_guildId_status_idx" ON "Ticket"("guildId", "status");

-- CreateIndex
CREATE INDEX "Ticket_guildId_createdAt_idx" ON "Ticket"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "Giveaway_guildId_idx" ON "Giveaway"("guildId");

-- CreateIndex
CREATE INDEX "Giveaway_endsAt_ended_idx" ON "Giveaway"("endsAt", "ended");

-- CreateIndex
CREATE INDEX "GiveawayCacheInvalidation_createdAt_idx" ON "GiveawayCacheInvalidation"("createdAt");

-- CreateIndex
CREATE INDEX "Suggestion_guildId_status_idx" ON "Suggestion"("guildId", "status");

-- CreateIndex
CREATE INDEX "Suggestion_guildId_createdAt_idx" ON "Suggestion"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "StarboardEntry_guildId_starCount_idx" ON "StarboardEntry"("guildId", "starCount");

-- CreateIndex
CREATE UNIQUE INDEX "StarboardEntry_guildId_originalMessageId_key" ON "StarboardEntry"("guildId", "originalMessageId");
