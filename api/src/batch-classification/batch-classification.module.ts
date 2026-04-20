import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ClassificationModule } from "@/projet-qualification/classification/classification.module";
import { BatchClassificationProcessor } from "./batch-classification.processor";
import { BatchClassificationController } from "./batch-classification.controller";
import { BATCH_CLASSIFICATION_QUEUE_NAME } from "./batch-classification.const";

@Module({
  imports: [
    ConfigModule,
    ClassificationModule,
    BullModule.registerQueue({
      name: BATCH_CLASSIFICATION_QUEUE_NAME,
    }),
    BullBoardModule.forFeature({
      name: BATCH_CLASSIFICATION_QUEUE_NAME,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [BatchClassificationController],
  providers: [BatchClassificationProcessor],
  exports: [BullModule],
})
export class BatchClassificationModule {}
