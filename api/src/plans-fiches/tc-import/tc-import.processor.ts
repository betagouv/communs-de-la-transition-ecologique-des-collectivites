import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import * as Sentry from "@sentry/node";
import { CustomLogger } from "@logging/logger.service";
import { TC_IMPORT_QUEUE_NAME } from "./tc-import.constants";
import { TcFetchService } from "./tc-fetch.service";
import { TcImportService } from "./tc-import.service";
import type { ImportStats } from "./tc-import.types";

@Processor(TC_IMPORT_QUEUE_NAME)
export class TcImportProcessor extends WorkerHost {
  constructor(
    private readonly fetchService: TcFetchService,
    private readonly importService: TcImportService,
    private readonly logger: CustomLogger,
  ) {
    super();
  }

  async process(job: Job): Promise<ImportStats> {
    const startTime = Date.now();
    this.logger.log(`Starting TC opendata import job (id=${job.id})...`);

    try {
      const { plans, fiches } = await this.fetchService.fetchAndParse();
      const stats = await this.importService.importAll(plans, fiches);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`TC import complete in ${duration}s`, { stats });

      return stats;
    } catch (error) {
      this.logger.error("TC opendata import failed", {
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      Sentry.captureException(error);
      throw error;
    }
  }
}
