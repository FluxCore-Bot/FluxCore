-- Existing guilds must keep the embed output they have today, while new guilds
-- get the plain format. A single column default cannot express that, because
-- upsertWelcomeConfig creates rows with `create: { guildId, ...dbData }` and
-- never sets these fields explicitly.
--
-- Step 1: add with the OLD value, backfilling every existing row.
ALTER TABLE "WelcomeConfig"
  ADD COLUMN "welcomeMessageStyle" TEXT NOT NULL DEFAULT 'embed',
  ADD COLUMN "welcomeContent" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "farewellMessageStyle" TEXT NOT NULL DEFAULT 'embed',
  ADD COLUMN "farewellContent" TEXT NOT NULL DEFAULT '';

-- Step 2: flip the default so rows created from now on get the new format.
-- This matches @default("plain") in schema.prisma.
ALTER TABLE "WelcomeConfig"
  ALTER COLUMN "welcomeMessageStyle" SET DEFAULT 'plain';
ALTER TABLE "WelcomeConfig"
  ALTER COLUMN "farewellMessageStyle" SET DEFAULT 'plain';
