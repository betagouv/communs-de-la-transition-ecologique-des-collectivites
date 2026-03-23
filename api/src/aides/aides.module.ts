import { Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule, InjectQueue } from "@nestjs/bullmq";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { Queue } from "bullmq";
import { ProjetsModule } from "@projets/projets.module";
import { ClassificationModule } from "@/projet-qualification/classification/classification.module";
import { CustomLogger } from "@logging/logger.service";
import { AidesController } from "./aides.controller";
import { AidesTerritoiresService } from "./aides-territoires.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesMatchingService } from "./aides-matching.service";
import { AidesCacheService } from "./aides-cache.service";
import { AidesSyncProcessor, AIDES_SYNC_QUEUE_NAME, AIDES_SYNC_JOB_NAME } from "./aides-sync.processor";

@Module({
  imports: [
    ConfigModule,
    ProjetsModule,
    ClassificationModule,
    BullModule.registerQueue({
      name: AIDES_SYNC_QUEUE_NAME,
    }),
    BullBoardModule.forFeature({
      name: AIDES_SYNC_QUEUE_NAME,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [AidesController],
  providers: [
    AidesTerritoiresService,
    AideClassificationService,
    AidesMatchingService,
    AidesCacheService,
    AidesSyncProcessor,
  ],
  exports: [AideClassificationService],
})
export class AidesModule implements OnModuleInit {
  constructor(
    @InjectQueue(AIDES_SYNC_QUEUE_NAME) private readonly syncQueue: Queue,
    private readonly logger: CustomLogger,
  ) {}

  /**
   * Register repeatable job on module init
   * Runs daily at 3:00 AM UTC
   */
  async onModuleInit() {
    // Remove existing repeatable jobs to avoid duplicates on restart
    const existingJobs = await this.syncQueue.getRepeatableJobs();
    for (const job of existingJobs) {
      await this.syncQueue.removeRepeatableByKey(job.key);
    }

    // Schedule daily sync at 3:00 AM UTC
    await this.syncQueue.add(
      AIDES_SYNC_JOB_NAME,
      {},
      {
        repeat: {
          pattern: "0 3 * * *", // Every day at 3:00 AM UTC
        },
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60000, // 1 min first retry
        },
      },
    );

    this.logger.log("Aides sync cron job registered: daily at 3:00 AM UTC");
  }
}
