import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ServiceApiKeyGuard } from "@/auth/service-api-key-guard";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { BATCH_CLASSIFICATION_QUEUE_NAME, BATCH_SUBMIT_JOB } from "./batch-classification.const";

@ApiBearerAuth()
@ApiTags("Management")
@Controller("management")
@UseGuards(ServiceApiKeyGuard)
export class BatchClassificationController {
  constructor(@InjectQueue(BATCH_CLASSIFICATION_QUEUE_NAME) private readonly batchQueue: Queue) {}

  @Post("batch-classify")
  @ApiOperation({
    summary: "Déclencher la classification batch des projets non classifiés",
    description:
      "Soumet tous les projets sans classificationScores à l'API Batch Anthropic. Le traitement est asynchrone (~24h). Suivre la progression dans le Bull Board (/queues).",
  })
  async triggerBatchClassification() {
    await this.batchQueue.add(BATCH_SUBMIT_JOB, {
      triggeredBy: "management-endpoint",
    });

    return { message: "Batch classification scheduled", queue: BATCH_CLASSIFICATION_QUEUE_NAME };
  }
}
