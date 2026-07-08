-- Convert DashboardAuditLog.details from text to jsonb, parsing existing rows.
-- This enables structured queries (e.g. details->>'reason') and removes the
-- double-encoding bug where readers had to JSON.parse the column.

ALTER TABLE "DashboardAuditLog"
  ALTER COLUMN "details" DROP DEFAULT,
  ALTER COLUMN "details" TYPE jsonb USING (
    CASE
      WHEN "details" IS NULL OR "details" = '' THEN '{}'::jsonb
      ELSE "details"::jsonb
    END
  ),
  ALTER COLUMN "details" SET DEFAULT '{}'::jsonb;
