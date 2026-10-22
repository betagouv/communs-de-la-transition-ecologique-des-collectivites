// Export of the consolidated base to the Cellar bucket (exports/ folder), one file per profile.
//
// Usage:
//   node dist/scripts/export-consultation/export-consultation.js --scheduled
//                                    nightly run from cron.json, a no-op unless
//                                    CONSULTATION_EXPORT_ENABLED=true
//   node dist/scripts/export-consultation/export-consultation.js [--force]
//                                    manual run; --force publishes an export that lost more
//                                    than half of its projects (after checking why)

import "dotenv/config";

import * as Sentry from "@sentry/node";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { currentEnv } from "@/shared/utils/currentEnv";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { ConsultationService } from "@/consultation/consultation.service";
import { ConsultationExportGenerator } from "@/consultation/export/consultation-export.generator";
import { ConsultationExportJob } from "@/consultation/export/consultation-export.job";
import { exportStoreFromEnv } from "@/consultation/export/s3-export-store";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: join(__dirname, `../../.env.${currentEnv}`),
    }),
  ],
  providers: [DatabaseService, CustomLogger, ConsultationService],
})
class ExportConsultationModule {}

async function main() {
  if (process.argv.includes("--scheduled") && process.env.CONSULTATION_EXPORT_ENABLED !== "true") {
    console.log(
      `Consultation export disabled (CONSULTATION_EXPORT_ENABLED=${process.env.CONSULTATION_EXPORT_ENABLED})`,
    );
    return;
  }
  const store = exportStoreFromEnv((key) => process.env[key]);
  if (!store) {
    console.error("Cellar is not configured (CELLAR_ADDON_* and CELLAR_EXPORT_BUCKET)");
    process.exit(1);
  }

  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.SCALINGO_ENV });
  const app = await NestFactory.createApplicationContext(ExportConsultationModule);
  let failed = false;

  try {
    const job = new ConsultationExportJob(
      new ConsultationExportGenerator(app.get(ConsultationService), store),
      process.env.CONSULTATION_EXPORT_MATTERMOST_WEBHOOK ?? process.env.TC_IMPORT_MATTERMOST_WEBHOOK,
      app.get(CustomLogger),
    );
    const manifest = await job.run({ force: process.argv.includes("--force") });
    console.log(JSON.stringify(manifest, null, 2));
  } catch (error) {
    console.error("Export failed:", error);
    failed = true;
  } finally {
    await app.close();
    await Sentry.flush(5000);
  }
  if (failed) process.exit(1);
}

void main();
