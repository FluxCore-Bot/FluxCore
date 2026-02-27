-- ============================================================
-- TempVoiceGuildConfig: guildId PK → autoincrement id PK
-- ============================================================

-- Step 1: Drop the existing primary key (guildId)
ALTER TABLE "TempVoiceGuildConfig" DROP CONSTRAINT "TempVoiceGuildConfig_pkey";

-- Step 2: Add auto-increment id column as new primary key
ALTER TABLE "TempVoiceGuildConfig" ADD COLUMN "id" SERIAL NOT NULL;
ALTER TABLE "TempVoiceGuildConfig" ADD CONSTRAINT "TempVoiceGuildConfig_pkey" PRIMARY KEY ("id");

-- Step 3: Add unique constraint on hubChannelId
CREATE UNIQUE INDEX "TempVoiceGuildConfig_hubChannelId_key" ON "TempVoiceGuildConfig"("hubChannelId");

-- Step 4: Add index on guildId for efficient lookups
CREATE INDEX "TempVoiceGuildConfig_guildId_idx" ON "TempVoiceGuildConfig"("guildId");

-- ============================================================
-- TempVoiceUserSettings: add configId, change unique constraint
-- ============================================================

-- Step 5: Drop the old unique constraint
DROP INDEX "TempVoiceUserSettings_guildId_userId_key";

-- Step 6: Add configId column (nullable first for existing rows)
ALTER TABLE "TempVoiceUserSettings" ADD COLUMN "configId" INTEGER;

-- Step 7: Populate configId from TempVoiceGuildConfig (matching by guildId)
UPDATE "TempVoiceUserSettings" AS us
SET "configId" = cfg."id"
FROM "TempVoiceGuildConfig" AS cfg
WHERE us."guildId" = cfg."guildId";

-- Step 8: Delete orphaned user settings that have no matching config
DELETE FROM "TempVoiceUserSettings" WHERE "configId" IS NULL;

-- Step 9: Make configId non-nullable
ALTER TABLE "TempVoiceUserSettings" ALTER COLUMN "configId" SET NOT NULL;

-- Step 10: Add new unique constraint (guildId, userId, configId)
CREATE UNIQUE INDEX "TempVoiceUserSettings_guildId_userId_configId_key" ON "TempVoiceUserSettings"("guildId", "userId", "configId");
