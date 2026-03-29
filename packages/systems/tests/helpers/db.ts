/**
 * Integration test database helpers.
 *
 * These utilities connect to a REAL PostgreSQL instance (the test-postgres
 * Docker service) and provide setup/teardown for each test.
 *
 * Requirements:
 *   - DATABASE_URL must point to the test database
 *   - Prisma migrations must be applied before running tests
 */

import { getPrisma, connectDatabase, disconnectDatabase } from "@fluxcore/database";

/**
 * Connect to the test database. Call in beforeAll().
 * Verifies that we're connected to a test DB to prevent accidents.
 */
export async function setupTestDatabase(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("test")) {
    throw new Error(
      "Refusing to run integration tests: DATABASE_URL does not contain 'test'. " +
        "Set DATABASE_URL to point to the test database.",
    );
  }
  await connectDatabase();
}

/**
 * Clean all data from tables used in tests. Call in beforeEach() or afterEach().
 * Uses TRUNCATE CASCADE for speed.
 */
export async function cleanTestData(): Promise<void> {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ActionRule",
      "ActionLog",
      "ActionGuildSettings",
      "ActionCacheInvalidation",
      "MusicGuildSettings",
      "MusicLibraryAlbum",
      "MusicLibraryTrack",
      "TempVoiceGuildConfig",
      "TempVoiceUserSettings",
      "Reminder",
      "DashboardSession",
      "TicketPanel",
      "Ticket",
      "TicketGuildSettings",
      "StarboardEntry",
      "StarboardGuildSettings"
    CASCADE
  `);
}

/**
 * Disconnect from the test database. Call in afterAll().
 */
export async function teardownTestDatabase(): Promise<void> {
  await disconnectDatabase();
}
