import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import * as Sentry from "@sentry/node";
import { CustomLogger } from "@logging/logger.service";
import { TC_IMPORT_QUEUE_NAME, TC_IMPORT_MONITOR_SLUG } from "./tc-import.constants";
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
    const checkInId = Sentry.captureCheckIn(
      { monitorSlug: TC_IMPORT_MONITOR_SLUG, status: "in_progress" },
      {
        schedule: { type: "crontab", value: "0 3 * * 0" },
        checkinMargin: 5,
        maxRuntime: 30,
        timezone: "UTC",
      },
    );

    const startTime = Date.now();
    this.logger.log(`Starting TC opendata import job (id=${job.id})...`);

    try {
      const { plans, fiches } = await this.fetchService.fetchAndParse();
      const stats = await this.importService.importAll(plans, fiches);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`TC import complete in ${duration}s`, { stats });

      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: TC_IMPORT_MONITOR_SLUG,
        status: "ok",
      });

      return stats;
    } catch (error) {
      this.logger.error("TC opendata import failed", {
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: TC_IMPORT_MONITOR_SLUG,
        status: "error",
      });

      Sentry.captureException(error);
      throw error;
    }
  }
}
