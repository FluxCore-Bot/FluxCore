-- CreateTable
CREATE TABLE "DashboardGuildSettings" (
    "guildId" TEXT NOT NULL,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "requirePermissions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardGuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "DashboardRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardRoleAssignment" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardUserPermission" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardUserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardAuditLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardRole_guildId_idx" ON "DashboardRole"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardRole_guildId_name_key" ON "DashboardRole"("guildId", "name");

-- CreateIndex
CREATE INDEX "DashboardRoleAssignment_guildId_userId_idx" ON "DashboardRoleAssignment"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardRoleAssignment_guildId_userId_roleId_key" ON "DashboardRoleAssignment"("guildId", "userId", "roleId");

-- CreateIndex
CREATE INDEX "DashboardUserPermission_guildId_userId_idx" ON "DashboardUserPermission"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardUserPermission_guildId_userId_permission_key" ON "DashboardUserPermission"("guildId", "userId", "permission");

-- CreateIndex
CREATE INDEX "DashboardAuditLog_guildId_createdAt_idx" ON "DashboardAuditLog"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "DashboardAuditLog_guildId_userId_idx" ON "DashboardAuditLog"("guildId", "userId");

-- CreateIndex
CREATE INDEX "DashboardAuditLog_createdAt_idx" ON "DashboardAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "DashboardRoleAssignment" ADD CONSTRAINT "DashboardRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "DashboardRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
