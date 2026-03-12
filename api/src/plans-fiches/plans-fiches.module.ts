import { Module, OnModuleInit } from "@nestjs/common";
import { BullModule, InjectQueue } from "@nestjs/bullmq";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { CustomLogger } from "@logging/logger.service";
import { PlansFichesController } from "./plans-fiches.controller";
import { GetPlansService } from "./services/get-plans.service";
import { GetFichesService } from "./services/get-fiches.service";
import { TcFetchService } from "./tc-import/tc-fetch.service";
import { TcImportService } from "./tc-import/tc-import.service";
import { TcImportProcessor } from "./tc-import/tc-import.processor";
import { TC_IMPORT_QUEUE_NAME, TC_IMPORT_JOB_NAME } from "./tc-import/tc-import.constants";

@Module({
  imports: [
    BullModule.registerQueue({
      name: TC_IMPORT_QUEUE_NAME,
    }),
    BullBoardModule.forFeature({
      name: TC_IMPORT_QUEUE_NAME,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [PlansFichesController],
  providers: [GetPlansService, GetFichesService, TcFetchService, TcImportService, TcImportProcessor],
  exports: [GetPlansService, GetFichesService],
})
export class PlansFichesModule implements OnModuleInit {
  constructor(
    @InjectQueue(TC_IMPORT_QUEUE_NAME) private readonly importQueue: Queue,
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
  ) {}

  async onModuleInit() {
    const cron = this.configService.get<string>("TC_IMPORT_CRON", "0 3 * * 0");
    const enabled = this.configService.get<string>("TC_IMPORT_ENABLED", "false");

    if (enabled !== "true") {
      this.logger.log(`TC import cron disabled (TC_IMPORT_ENABLED=${enabled})`);
      return;
    }

    // Remove any stale repeatable jobs before adding the current one
    const existing = await this.importQueue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === TC_IMPORT_JOB_NAME) {
        await this.importQueue.removeRepeatableByKey(job.key);
      }
    }

    await this.importQueue.add(
      TC_IMPORT_JOB_NAME,
      {},
      {
        repeat: { pattern: cron },
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );

    this.logger.log(`TC import cron scheduled: ${cron}`);
  }
}
