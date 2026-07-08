-- Switch DashboardRoleAssignment.role FK from ON DELETE CASCADE to ON DELETE RESTRICT.
-- This prevents silent privilege loss: deleting a DashboardRole that still has
-- active assignments now fails, forcing callers to go through the audited
-- deleteDashboardRoleWithAudit() helper which enumerates and audit-logs each
-- unassignment before removing the role.

ALTER TABLE "DashboardRoleAssignment"
  DROP CONSTRAINT "DashboardRoleAssignment_roleId_fkey";

ALTER TABLE "DashboardRoleAssignment"
  ADD CONSTRAINT "DashboardRoleAssignment_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "DashboardRole"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
