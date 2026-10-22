// Import of the referentiel collectivites into the database, volume guard included.
//
// Usage:
//   pnpm seed:referentiel                       manual run (ts-node)
//   node dist/scripts/seed-referentiel/seed-referentiel.js --scheduled
//                                               weekly run from cron.json, a no-op unless
//                                               REFERENTIEL_IMPORT_ENABLED=true

import "dotenv/config";

import * as Sentry from "@sentry/node";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { currentEnv } from "@/shared/utils/currentEnv";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { ReferentielSeedService } from "@/referentiel/seed/referentiel-seed.service";
import { ReferentielImportService } from "@/referentiel/seed/import.service";
import { ReferentielImportJob } from "@/referentiel/seed/referentiel-import.job";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: join(__dirname, `../../.env.${currentEnv}`),
    }),
  ],
  providers: [DatabaseService, CustomLogger, ReferentielSeedService, ReferentielImportService, ReferentielImportJob],
})
class SeedReferentielModule {}

async function main() {
  const scheduled = process.argv.includes("--scheduled");
  if (scheduled && process.env.REFERENTIEL_IMPORT_ENABLED !== "true") {
    console.log(`Referentiel import disabled (REFERENTIEL_IMPORT_ENABLED=${process.env.REFERENTIEL_IMPORT_ENABLED})`);
    return;
  }

  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.SCALINGO_ENV });
  const app = await NestFactory.createApplicationContext(SeedReferentielModule);
  let failed = false;

  try {
    const stats = await app.get(ReferentielImportJob).run();
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error("Seed failed:", error);
    failed = true;
  } finally {
    await app.close();
    await Sentry.flush(5000);
  }
  if (failed) process.exit(1);
}

void main();
