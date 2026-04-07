-- Annotation-only migration: DashboardSession.accessToken is now contractually
-- required to be AES-256-GCM ciphertext (see apps/dashboard/src/server/shared/crypto.ts).
-- The schema /// @encrypted doc-comment locks the contract; existing plaintext rows
-- (if any) must be backfilled via scripts/migrate-encrypt-session-tokens.ts.
-- No DDL is required because the column type is unchanged.
SELECT 1;
