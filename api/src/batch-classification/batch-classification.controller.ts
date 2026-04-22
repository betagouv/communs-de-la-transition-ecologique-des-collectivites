import { Controller, Post, Body, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ServiceApiKeyGuard } from "@/auth/service-api-key-guard";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { BATCH_CLASSIFICATION_QUEUE_NAME, BATCH_SUBMIT_JOB, BATCH_PROCESS_JOB } from "./batch-classification.const";

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
      "Soumet les projets sans classificationScores à l'API Batch Anthropic. Le traitement est asynchrone (~24h). Suivre la progression dans le Bull Board (/queues).",
  })
  @ApiQuery({ name: "limit", required: false, description: "Nombre max de projets à classifier (défaut: tous)" })
  @ApiQuery({
    name: "source",
    required: false,
    description: "Filtrer par source: MEC, TeT, Recoco, etc. (défaut: tous)",
  })
  async triggerBatchClassification(@Query("limit") limit?: string, @Query("source") source?: string) {
    const maxProjects = limit ? parseInt(limit, 10) : undefined;

    await this.batchQueue.add(BATCH_SUBMIT_JOB, {
      triggeredBy: "management-endpoint",
      maxProjects,
      source,
    });

    const parts = [
      "Batch classification scheduled",
      maxProjects ? `limit: ${maxProjects}` : null,
      source ? `source: ${source}` : null,
    ].filter(Boolean);

    return {
      message: parts[0] + (parts.length > 1 ? ` (${parts.slice(1).join(", ")})` : ""),
      queue: BATCH_CLASSIFICATION_QUEUE_NAME,
    };
  }

  @Post("batch-classify/recover")
  @ApiOperation({
    summary: "Récupérer les résultats de batches Anthropic déjà terminés",
    description:
      "Enqueue un job 'process' pour chaque batch ID fourni. Utile si les jobs poll/process ont été supprimés mais que les batches ont terminé côté Anthropic.",
  })
  async recoverBatchResults(@Body() body: { batchIds: string[] }) {
    const { batchIds } = body;

    for (const batchId of batchIds) {
      await this.batchQueue.add(BATCH_PROCESS_JOB, { batchId });
    }

    return {
      message: `${batchIds.length} process jobs enqueued`,
      batchIds,
    };
  }
}
