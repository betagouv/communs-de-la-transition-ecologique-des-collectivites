import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import { thematiques } from "../const/thematiques";
import { sites } from "../const/sites";
import { interventions } from "../const/interventions";
import { findClosestMatch } from "./levenshtein";
import { ClassificationLLMResponse } from "../llm/prompts/types";

type ClassificationAxis = "thematiques" | "sites" | "interventions";

/**
 * Service for validating and correcting classification labels from LLM responses
 * Uses Levenshtein distance for fuzzy matching when exact match fails
 */
@Injectable()
export class ClassificationValidationService {
  constructor(private readonly logger: CustomLogger) {}

  /**
   * Validate and correct labels from LLM response against the referential
   * Uses Levenshtein distance for fuzzy matching when exact match fails
   * @param response Raw LLM response with items array [{label, score}]
   * @param axis Classification axis to validate against
   * @returns Corrected labels as Record<string, number>
   */
  validateAndCorrect(response: ClassificationLLMResponse, axis: ClassificationAxis): Record<string, number> {
    const referential = this.getReferential(axis);
    const corrected: Record<string, number> = {};

    for (const item of response.items) {
      const { label, score } = item;

      // 1. Check exact match
      if (referential.includes(label)) {
        // Keep highest score if duplicate
        if (!corrected[label] || corrected[label] < score) {
          corrected[label] = score;
        }
        continue;
      }

      // 2. Try Levenshtein fuzzy matching
      const closest = findClosestMatch(label, referential);
      if (closest) {
        this.logger.warn(
          `Corrected hallucinated label: "${label}" → "${closest.match}" (distance: ${closest.distance})`,
        );
        if (!corrected[closest.match] || corrected[closest.match] < score) {
          corrected[closest.match] = score;
        }
      } else {
        this.logger.warn(`Removed invalid label with no close match: "${label}"`);
      }
    }

    return corrected;
  }

  private getReferential(axis: ClassificationAxis): readonly string[] {
    switch (axis) {
      case "thematiques":
        return thematiques;
      case "sites":
        return sites;
      case "interventions":
        return interventions;
    }
  }
}
