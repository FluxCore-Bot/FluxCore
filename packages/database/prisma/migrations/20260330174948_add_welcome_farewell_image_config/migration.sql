-- AlterTable
ALTER TABLE "WelcomeConfig" ADD COLUMN     "farewellImageConfig" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "farewellImageEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "welcomeImageConfig" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "welcomeImageEnabled" BOOLEAN NOT NULL DEFAULT false;
