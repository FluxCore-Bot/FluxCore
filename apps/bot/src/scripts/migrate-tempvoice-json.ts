import "dotenv/config";
import { getPrisma, connectDatabase, disconnectDatabase } from "@fluxcore/database";
import { readFileSync, existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, "..", "..", "data", "tempvoice.json");

async function migrate(): Promise<void> {
  if (!existsSync(JSON_PATH)) {
    console.log("No tempvoice.json found, nothing to migrate.");
    return;
  }

  await connectDatabase();
  const prisma = getPrisma();

  try {
    const raw = readFileSync(JSON_PATH, "utf-8");
    const data = JSON.parse(raw) as {
      guilds: Record<
        string,
        { hubChannelId: string; categoryId: string | null; nameTemplate: string }
      >;
    };

    let count = 0;
    for (const [guildId, config] of Object.entries(data.guilds)) {
      await prisma.tempVoiceGuildConfig.upsert({
        where: { hubChannelId: config.hubChannelId },
        update: { categoryId: config.categoryId, nameTemplate: config.nameTemplate },
        create: { guildId, ...config },
      });
      count++;
    }

    console.log(`Migrated ${count} guild config(s) to database.`);
    renameSync(JSON_PATH, JSON_PATH + ".bak");
    console.log("Renamed tempvoice.json to tempvoice.json.bak");
  } finally {
    await disconnectDatabase();
  }
}

migrate().catch(console.error);
