-- CreateTable
CREATE TABLE "ActionCacheInvalidation" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionCacheInvalidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionCacheInvalidation_createdAt_idx" ON "ActionCacheInvalidation"("createdAt");
