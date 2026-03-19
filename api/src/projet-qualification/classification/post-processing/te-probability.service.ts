import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import { TE_PROBABILITIES } from "../const/probabilites-te";

/**
 * Service for calculating the probability that a project is related
 * to ecological transition (TE) based on its classification labels
 */
@Injectable()
export class TEProbabilityService {
  constructor(private readonly logger: CustomLogger) {}

  /**
   * Calculate weighted TE probability from all classification labels
   * Uses the TE_PROBABILITIES lookup table for each label
   * Returns the weighted average of TE probabilities, weighted by classification scores
   * @param labels Record of label -> classification score from all axes
   * @returns TE probability between 0 and 1, or null if no labels matched
   */
  calculate(labels: Record<string, number>): number | null {
    const entries = Object.entries(labels);

    if (entries.length === 0) {
      this.logger.log("No labels provided for TE probability calculation");
      return null;
    }

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [label, classificationScore] of entries) {
      const teProbability = TE_PROBABILITIES[label];

      if (teProbability !== undefined) {
        weightedSum += teProbability * classificationScore;
        totalWeight += classificationScore;
      } else {
        this.logger.warn(`No TE probability found for label: "${label}"`);
      }
    }

    if (totalWeight === 0) {
      return null;
    }

    const result = Math.round((weightedSum / totalWeight) * 100) / 100;
    this.logger.log(`Calculated TE probability: ${result}`);
    return result;
  }
}
