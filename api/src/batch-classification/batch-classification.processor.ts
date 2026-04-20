import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { isNull, eq } from "drizzle-orm";
import { CustomLogger } from "@logging/logger.service";
import { DatabaseService } from "@database/database.service";
import { projets } from "@database/schema";
import { ClassificationAnthropicService } from "@/projet-qualification/classification/llm/classification-anthropic.service";
import { ClassificationValidationService } from "@/projet-qualification/classification/validation/classification-validation.service";
import { EnrichmentService } from "@/projet-qualification/classification/post-processing/enrichment.service";
import { TEProbabilityService } from "@/projet-qualification/classification/post-processing/te-probability.service";
import * as Sentry from "@sentry/node";
import {
  BATCH_CLASSIFICATION_QUEUE_NAME,
  BATCH_SUBMIT_JOB,
  BATCH_POLL_JOB,
  BATCH_PROCESS_JOB,
  ANTHROPIC_BATCH_MAX_REQUESTS,
  POLL_DELAY_MS,
  MAX_POLL_ATTEMPTS,
  DB_WRITE_CHUNK_SIZE,
  CLASSIFICATION_AXES,
  ClassificationAxis,
} from "./batch-classification.const";

/** Page size for paginated SELECT of unclassified projects */
const SELECT_PAGE_SIZE = 5000;

interface ProjectForClassification {
  id: string;
  nom: string;
  description: string | null;
}

@Processor(BATCH_CLASSIFICATION_QUEUE_NAME)
export class BatchClassificationProcessor extends WorkerHost {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly anthropicService: ClassificationAnthropicService,
    private readonly validationService: ClassificationValidationService,
    private readonly enrichmentService: EnrichmentService,
    private readonly teProbabilityService: TEProbabilityService,
    @InjectQueue(BATCH_CLASSIFICATION_QUEUE_NAME) private readonly batchQueue: Queue,
    private readonly logger: CustomLogger,
  ) {
    super();
  }

  async process(
    job: Job<{
      triggeredBy?: string;
      projectCount?: number;
      batchIds?: string[];
      totalProjects?: number;
      batchId?: string;
    }>,
  ) {
    switch (job.name) {
      case BATCH_SUBMIT_JOB:
        return this.handleSubmit(job);
      case BATCH_POLL_JOB:
        return this.handlePoll(job as Job<{ batchIds: string[]; totalProjects: number }>);
      case BATCH_PROCESS_JOB:
        return this.handleProcess(job as Job<{ batchId: string }>);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  /**
   * Step 1: Collect unclassified projects (paginated), build batch requests, submit to Anthropic.
   */
  private async handleSubmit(job: Job<{ triggeredBy?: string; projectCount?: number }>) {
    this.logger.log(
      `Batch classification submit triggered (${job.data.triggeredBy ?? "unknown"}, ~${job.data.projectCount ?? "?"} projects)`,
    );

    try {
      // Collect unclassified projects with pagination to avoid loading 80k+ rows in RAM
      const unclassified = await this.fetchUnclassifiedProjects();

      if (unclassified.length === 0) {
        this.logger.log("No unclassified projects found, skipping batch");
        return { submitted: 0 };
      }

      this.logger.log(`Found ${unclassified.length} unclassified projects`);

      // Build batch requests (3 per project, max 100k per batch)
      const requestsPerProject = CLASSIFICATION_AXES.length; // 3
      const projectsPerBatch = Math.floor(ANTHROPIC_BATCH_MAX_REQUESTS / requestsPerProject);
      const projectChunks = this.chunkArray(unclassified, projectsPerBatch);

      const client = this.anthropicService.getClient();
      const batchIds: string[] = [];

      for (let i = 0; i < projectChunks.length; i++) {
        const chunk = projectChunks[i];
        const requests = this.buildBatchRequests(chunk);

        this.logger.log(
          `Submitting batch ${i + 1}/${projectChunks.length} with ${requests.length} requests (${chunk.length} projects)`,
        );

        const batch = await client.messages.batches.create({ requests });
        batchIds.push(batch.id);

        this.logger.log(`Batch ${i + 1} submitted: ${batch.id} (status: ${batch.processing_status})`);
      }

      // Enqueue poll job
      await this.batchQueue.add(
        BATCH_POLL_JOB,
        { batchIds, totalProjects: unclassified.length },
        {
          delay: POLL_DELAY_MS,
          attempts: MAX_POLL_ATTEMPTS,
          backoff: { type: "fixed", delay: POLL_DELAY_MS },
        },
      );

      this.logger.log(`Batch submit complete: ${batchIds.length} batches, poll scheduled in ${POLL_DELAY_MS / 1000}s`);

      return { batchIds, totalProjects: unclassified.length };
    } catch (error) {
      this.logger.error("Batch submit failed", {
        error: { message: error instanceof Error ? error.message : "Unknown error" },
      });
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Step 2: Poll Anthropic batch status. Throws if not done (BullMQ retries with backoff).
   */
  private async handlePoll(job: Job<{ batchIds: string[]; totalProjects: number }>) {
    const { batchIds } = job.data;
    const client = this.anthropicService.getClient();

    let allEnded = true;
    const statuses: string[] = [];

    for (const batchId of batchIds) {
      const batch = await client.messages.batches.retrieve(batchId);
      statuses.push(`${batchId}: ${batch.processing_status}`);

      if (batch.processing_status !== "ended") {
        allEnded = false;
      }
    }

    this.logger.log(`Batch poll (attempt ${job.attemptsMade + 1}/${MAX_POLL_ATTEMPTS}): ${statuses.join(", ")}`);

    if (!allEnded) {
      // Throw to trigger BullMQ retry with backoff
      throw new Error(`Batches not yet complete: ${statuses.join(", ")}`);
    }

    // All batches ended — enqueue process jobs (one per batch)
    for (const batchId of batchIds) {
      await this.batchQueue.add(BATCH_PROCESS_JOB, { batchId });
    }

    this.logger.log(`All ${batchIds.length} batches ended, processing jobs enqueued`);

    return { status: "ended", batchIds };
  }

  /**
   * Step 3: Stream results from a completed batch, apply post-processing, write to DB.
   */
  private async handleProcess(job: Job<{ batchId: string }>) {
    const { batchId } = job.data;
    const client = this.anthropicService.getClient();

    this.logger.log(`Processing results for batch ${batchId}`);

    try {
      // Stream results and group by project
      const projectResults = new Map<string, Map<ClassificationAxis, Record<string, number>>>();
      let succeeded = 0;
      let failed = 0;

      const results = await client.messages.batches.results(batchId);
      for await (const result of results) {
        const { projectId, axis } = this.parseCustomId(result.custom_id);

        if (result.result.type !== "succeeded") {
          failed++;
          this.logger.warn(`Batch result failed for ${result.custom_id}: ${result.result.type}`);
          continue;
        }

        const textContent = result.result.message.content.find((b) => b.type === "text");
        if (textContent?.type !== "text") {
          failed++;
          continue;
        }

        // Parse LLM response using existing parser
        const parsed = this.anthropicService.parseResponse(textContent.text, projectId);
        if (parsed.errorMessage) {
          failed++;
          this.logger.warn(`Parse error for ${result.custom_id}: ${parsed.errorMessage}`);
          continue;
        }

        // Convert items to Record<string, number> for validation service
        const labelsMap: Record<string, number> = {};
        for (const item of parsed.json.items) {
          labelsMap[item.label] = item.score;
        }

        if (!projectResults.has(projectId)) {
          projectResults.set(projectId, new Map());
        }
        projectResults.get(projectId)!.set(axis, labelsMap);
        succeeded++;
      }

      this.logger.log(`Parsed ${succeeded} results (${failed} failed) for ${projectResults.size} projects`);

      // Filter out incomplete projects (need all 3 axes)
      const completeProjects = Array.from(projectResults.entries()).filter(([projectId, axes]) => {
        if (axes.size < CLASSIFICATION_AXES.length) {
          this.logger.warn(
            `Project ${projectId} has only ${axes.size}/${CLASSIFICATION_AXES.length} axes, skipping (will be retried in next batch)`,
          );
          return false;
        }
        return true;
      });

      this.logger.log(
        `${completeProjects.length} complete projects (${projectResults.size - completeProjects.length} incomplete, skipped)`,
      );

      // Apply post-processing and write to DB in chunks (sequential to avoid pool saturation)
      const chunks = this.chunkArray(completeProjects, DB_WRITE_CHUNK_SIZE);
      let written = 0;

      for (const chunk of chunks) {
        const updates = chunk.map(([projectId, axes]) => {
          // Validate against referentials (Levenshtein anti-hallucination)
          let thematiques = this.validationService.validateAndCorrect(
            { projet: projectId, items: this.mapToItems(axes.get("thematiques")!) },
            "thematiques",
          );
          let sites = this.validationService.validateAndCorrect(
            { projet: projectId, items: this.mapToItems(axes.get("sites")!) },
            "sites",
          );
          let interventions = this.validationService.validateAndCorrect(
            { projet: projectId, items: this.mapToItems(axes.get("interventions")!) },
            "interventions",
          );

          // Enrichment (domain rules)
          const enriched = this.enrichmentService.enrich({ thematiques, sites, interventions });
          thematiques = enriched.thematiques;
          sites = enriched.sites;
          interventions = enriched.interventions;

          // TE probability
          const probabiliteTE = this.teProbabilityService.calculate(thematiques);

          // Build classification scores (all scores, no threshold)
          const classificationScores = {
            thematiques: this.toSortedLabels(thematiques),
            sites: this.toSortedLabels(sites),
            interventions: this.toSortedLabels(interventions),
          };

          return {
            projectId,
            classificationScores,
            classificationThematiques: classificationScores.thematiques
              .filter((t) => t.score >= 0.8)
              .map((t) => t.label),
            classificationSites: classificationScores.sites.filter((s) => s.score >= 0.8).map((s) => s.label),
            classificationInterventions: classificationScores.interventions
              .filter((i) => i.score >= 0.8)
              .map((i) => i.label),
            probabiliteTE: probabiliteTE !== null ? String(probabiliteTE) : null,
          };
        });

        // Write to DB sequentially to avoid saturating the connection pool
        for (const u of updates) {
          await this.dbService.database
            .update(projets)
            .set({
              classificationScores: u.classificationScores,
              classificationThematiques: u.classificationThematiques,
              classificationSites: u.classificationSites,
              classificationInterventions: u.classificationInterventions,
              probabiliteTE: u.probabiliteTE,
            })
            .where(eq(projets.id, u.projectId));
        }

        written += updates.length;
        this.logger.log(`Batch process progress: ${written}/${completeProjects.length} projects written`);
      }

      this.logger.log(`Batch ${batchId} processing complete: ${written} projects classified`);

      return { batchId, classified: written, failed };
    } catch (error) {
      this.logger.error(`Batch process failed for ${batchId}`, {
        error: { message: error instanceof Error ? error.message : "Unknown error" },
      });
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Fetch unclassified projects with pagination to avoid loading everything in RAM.
   */
  private async fetchUnclassifiedProjects(): Promise<ProjectForClassification[]> {
    const allProjects: ProjectForClassification[] = [];
    let offset = 0;

    while (true) {
      const page = await this.dbService.database
        .select({ id: projets.id, nom: projets.nom, description: projets.description })
        .from(projets)
        .where(isNull(projets.classificationScores))
        .limit(SELECT_PAGE_SIZE)
        .offset(offset);

      allProjects.push(...page);

      if (page.length < SELECT_PAGE_SIZE) break;
      offset += SELECT_PAGE_SIZE;

      this.logger.log(`Fetched ${allProjects.length} unclassified projects so far...`);
    }

    return allProjects;
  }

  /**
   * Parse custom_id format "projectId:axis". Uses lastIndexOf to handle
   * any edge case where the projectId might contain colons.
   */
  private parseCustomId(customId: string): { projectId: string; axis: ClassificationAxis } {
    const lastColon = customId.lastIndexOf(":");
    return {
      projectId: customId.slice(0, lastColon),
      axis: customId.slice(lastColon + 1) as ClassificationAxis,
    };
  }

  private buildBatchRequests(projects: ProjectForClassification[]) {
    return projects.flatMap((p) => {
      const context = `${p.nom}\n${p.description ?? ""}`;
      return CLASSIFICATION_AXES.map((axis) => ({
        custom_id: `${p.id}:${axis}`,
        params: this.anthropicService.buildMessageParams(context, axis, "projet"),
      }));
    });
  }

  private mapToItems(labels: Record<string, number>) {
    return Object.entries(labels).map(([label, score]) => ({ label, score }));
  }

  private toSortedLabels(labels: Record<string, number>) {
    return Object.entries(labels)
      .sort(([, a], [, b]) => b - a)
      .map(([label, score]) => ({ label, score }));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
