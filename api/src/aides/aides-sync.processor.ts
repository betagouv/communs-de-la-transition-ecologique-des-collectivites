import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { CustomLogger } from "@logging/logger.service";
import * as Sentry from "@sentry/node";
import { AidesTerritoiresService } from "./aides-territoires.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesCacheService } from "./aides-cache.service";

export const AIDES_SYNC_QUEUE_NAME = "aides-sync";
export const AIDES_SYNC_JOB_NAME = "aides-sync-classification";

/**
 * BullMQ processor for periodic aides classification sync
 * Runs as a repeatable job (cron schedule)
 */
@Processor(AIDES_SYNC_QUEUE_NAME)
export class AidesSyncProcessor extends WorkerHost {
  constructor(
    private readonly atService: AidesTerritoiresService,
    private readonly classificationService: AideClassificationService,
    private readonly cacheService: AidesCacheService,
    private readonly logger: CustomLogger,
  ) {
    super();
  }

  async process(job: Job): Promise<{ classified: number; cached: number; total: number }> {
    this.logger.log(`Starting aides sync job ${job.id}`);

    try {
      // Fetch all aides from AT
      const aides = await this.atService.fetchAides();
      this.logger.log(`Fetched ${aides.length} aides from AT API`);

      // Classify new/modified aides
      const result = await this.classificationService.syncClassifications(aides);

      // Invalidate AT cache
      await this.cacheService.invalidateAll();

      this.logger.log(
        `Aides sync complete: ${result.classified} classified, ${result.cached} cached, ${aides.length} total`,
      );

      return { ...result, total: aides.length };
    } catch (error) {
      this.logger.error("Aides sync job failed", {
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
