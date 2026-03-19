import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import { ClassificationAnthropicService } from "./llm/classification-anthropic.service";
import { ClassificationValidationService } from "./validation/classification-validation.service";
import { EnrichmentService } from "./post-processing/enrichment.service";
import { TEProbabilityService } from "./post-processing/te-probability.service";
import { ClassificationResponse, ClassificationLabelDto } from "./dto/classification.dto";

const DEFAULT_SCORE_THRESHOLD = 0.8;

@Injectable()
export class ClassificationService {
  constructor(
    private readonly anthropicService: ClassificationAnthropicService,
    private readonly validationService: ClassificationValidationService,
    private readonly enrichmentService: EnrichmentService,
    private readonly teProbabilityService: TEProbabilityService,
    private readonly logger: CustomLogger,
  ) {}

  async classify(
    context: string,
    type: "projet" | "aide" = "projet",
    scoreThreshold?: number,
  ): Promise<ClassificationResponse> {
    this.logger.log(`Starting classification for ${type}`);

    // Step 1: Call LLM for all 3 axes in parallel
    const [thematiquesResult, sitesResult, interventionsResult] = await Promise.all([
      this.anthropicService.analyzeThematiques(context, type),
      this.anthropicService.analyzeSites(context, type),
      this.anthropicService.analyzeInterventions(context, type),
    ]);

    // Check for errors
    for (const result of [thematiquesResult, sitesResult, interventionsResult]) {
      if (result.errorMessage) {
        throw new InternalServerErrorException(`Classification error: ${result.errorMessage}`);
      }
    }

    // Step 2: Validate against referentials (anti-hallucination via Levenshtein)
    let thematiques = this.validationService.validateAndCorrect(thematiquesResult.json, "thematiques");
    let sites = this.validationService.validateAndCorrect(sitesResult.json, "sites");
    let interventions = this.validationService.validateAndCorrect(interventionsResult.json, "interventions");

    // Step 3: Apply enrichment post-processing (only for projets)
    if (type === "projet") {
      const enriched = this.enrichmentService.enrich({ thematiques, sites, interventions });
      thematiques = enriched.thematiques;
      sites = enriched.sites;
      interventions = enriched.interventions;
    }

    // Step 4: Calculate TE probability (before threshold filtering, using all thematiques)
    const probabiliteTE = this.teProbabilityService.calculate(thematiques);

    // Step 5: Apply score threshold filtering (only for projets)
    const threshold = type === "projet" ? (scoreThreshold ?? DEFAULT_SCORE_THRESHOLD) : 0;

    return {
      projet: context,
      thematiques: this.toSortedLabels(thematiques, threshold),
      sites: this.toSortedLabels(sites, threshold),
      interventions: this.toSortedLabels(interventions, threshold),
      probabiliteTE,
    };
  }

  private toSortedLabels(labels: Record<string, number>, threshold: number): ClassificationLabelDto[] {
    return Object.entries(labels)
      .filter(([, score]) => score >= threshold)
      .sort(([, a], [, b]) => b - a)
      .map(([label, score]) => ({ label, score }));
  }
}
