import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import { encrypt, isEncrypted } from "../apps/dashboard/src/server/shared/crypto.js";

export interface BackfillSummary {
  encrypted: number;
  skipped: number;
}

/**
 * One-shot backfill: re-encrypt any DashboardSession.accessToken rows that
 * are still stored as plaintext (legacy environments pre-dating the
 * encryption helper). Idempotent — already-encrypted rows are skipped.
 */
export async function backfillEncryptSessionTokens(): Promise<BackfillSummary> {
  const prisma = getPrisma();
  const rows = await prisma.dashboardSession.findMany({
    select: { id: true, accessToken: true },
  });

  let encrypted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (isEncrypted(row.accessToken)) {
      skipped++;
      continue;
    }
    await prisma.dashboardSession.update({
      where: { id: row.id },
      data: { accessToken: encrypt(row.accessToken) },
    });
    encrypted++;
  }

  logger.info(
    `DashboardSession backfill complete: encrypted=${encrypted} skipped=${skipped}`,
  );
  return { encrypted, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  backfillEncryptSessionTokens()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("Backfill failed", err as Error);
      process.exit(1);
    });
}
