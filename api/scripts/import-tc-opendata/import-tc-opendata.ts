// Manual import of TC (Territoires Climat) opendata into the database.
// Reuses the same services as the scheduled BullMQ job.
//
// Usage: pnpm import:tc-opendata

import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { currentEnv } from "@/shared/utils/currentEnv";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { TcFetchService } from "@/plans-fiches/tc-import/tc-fetch.service";
import { TcImportService } from "@/plans-fiches/tc-import/tc-import.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: join(__dirname, `../../.env.${currentEnv}`),
    }),
  ],
  providers: [DatabaseService, CustomLogger, TcFetchService, TcImportService],
})
class ImportTcModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(ImportTcModule);
  const fetchService = app.get(TcFetchService);
  const importService = app.get(TcImportService);

  try {
    console.log("=== Import TC Opendata (PCAET) ===\n");
    const startTime = Date.now();

    const { plans, fiches } = await fetchService.fetchAndParse();
    const stats = await importService.importAll(plans, fiches);

    console.log("\n=== Import Complete ===");
    console.log(JSON.stringify(stats, null, 2));
    console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void main();
