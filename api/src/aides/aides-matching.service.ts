/**
 * Matching engine for projects and aides
 *
 * Algorithm (from Gaëtan's match_projets_aides.py):
 *
 * Both projects and aides are pre-classified on 3 axes (thématiques, sites,
 * interventions), each label having a confidence score between 0 and 1.
 *
 * For each axis:
 *   1. Keep only labels with score ≥ threshold (high confidence). The threshold
 *      defaults to 0.8 but can be set independently for the project side and
 *      the aide side (see `match` thresholds option).
 *   2. Find common labels between the project and the aide
 *   3. For each common label, compute:
 *        term = (score_project - projetThreshold + offset)
 *             × (score_aide   - aideThreshold   + offset)
 *      The offset (0.1) means a label just above its threshold contributes a
 *      small weight, a label at 1.0 contributes a large one.
 *   4. Axis score = sum(terms) / number of project labels on this axis
 *      Division normalizes so projects with fewer labels aren't penalized
 *
 * Total score = 0.45 × score_thématiques + 0.35 × score_sites + 0.20 × score_interventions
 *   The axis weights make the thematic relevance dominant, the location
 *   secondary, and the intervention type a lighter tie-breaker.
 */

import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import { AideClassification, AideMatchResult } from "./dto/aides.dto";

/** Per-call confidence thresholds. Absent values fall back to DEFAULT_THRESHOLD. */
export interface MatchThresholds {
  projet?: number;
  aide?: number;
}

@Injectable()
export class AidesMatchingService {
  /** Default confidence threshold (Gaëtan's script: THRESHOLD=80 on the 0-100 scale). */
  static readonly DEFAULT_THRESHOLD = 0.8;
  private readonly SCORE_OFFSET = 0.1;

  // Relative weight of each axis in the total score (must sum to 1)
  private readonly WEIGHT_THEMATIQUES = 0.45;
  private readonly WEIGHT_SITES = 0.35;
  private readonly WEIGHT_INTERVENTIONS = 0.2;

  constructor(private readonly logger: CustomLogger) {}

  /**
   * Match a project against a set of classified aides
   * @param projetScores Classification scores of the project
   * @param aidesScores Map of aide id_at -> classification scores
   * @param limit Max number of results
   * @param thresholds Optional per-side confidence thresholds (default 0.8 each)
   * @returns Sorted list of matching aides with scores
   */
  match(
    projetScores: AideClassification,
    aidesScores: Map<string, AideClassification>,
    limit = 10,
    thresholds?: MatchThresholds,
  ): AideMatchResult[] {
    const projetThreshold = thresholds?.projet ?? AidesMatchingService.DEFAULT_THRESHOLD;
    const aideThreshold = thresholds?.aide ?? AidesMatchingService.DEFAULT_THRESHOLD;

    // Filter project labels by the project threshold
    const pThematiques = this.filterByThreshold(projetScores.thematiques, projetThreshold);
    const pSites = this.filterByThreshold(projetScores.sites, projetThreshold);
    const pInterventions = this.filterByThreshold(projetScores.interventions, projetThreshold);

    const projectMax = this.computeProjectMax(pThematiques, pSites, pInterventions, projetThreshold, aideThreshold);

    // Build inverted index for fast candidate lookup
    const candidates = this.findCandidates(pThematiques, pSites, pInterventions, aidesScores, aideThreshold);

    // Score each candidate
    const results: AideMatchResult[] = [];

    for (const idAt of candidates) {
      const aideScores = aidesScores.get(idAt)!;

      const aThematiques = this.filterByThreshold(aideScores.thematiques, aideThreshold);
      const aSites = this.filterByThreshold(aideScores.sites, aideThreshold);
      const aInterventions = this.filterByThreshold(aideScores.interventions, aideThreshold);

      const thResult = this.scoreAxis(pThematiques, aThematiques, projetThreshold, aideThreshold);
      const siResult = this.scoreAxis(pSites, aSites, projetThreshold, aideThreshold);
      const inResult = this.scoreAxis(pInterventions, aInterventions, projetThreshold, aideThreshold);

      const totalScore =
        this.WEIGHT_THEMATIQUES * thResult.score +
        this.WEIGHT_SITES * siResult.score +
        this.WEIGHT_INTERVENTIONS * inResult.score;

      if (totalScore > 0) {
        const axesMatched =
          (thResult.commonLabels.length > 0 ? 1 : 0) +
          (siResult.commonLabels.length > 0 ? 1 : 0) +
          (inResult.commonLabels.length > 0 ? 1 : 0);

        results.push({
          idAt,
          score: Math.round(totalScore * 100) / 100,
          normalizedScore: projectMax > 0 ? Math.round((totalScore / projectMax) * 100) / 100 : 0,
          scoreThematiques: Math.round(thResult.score * 100) / 100,
          scoreSites: Math.round(siResult.score * 100) / 100,
          scoreInterventions: Math.round(inResult.score * 100) / 100,
          axesMatched,
          labelsCommuns: {
            thematiques: thResult.commonLabels,
            sites: siResult.commonLabels,
            interventions: inResult.commonLabels,
          },
        });
      }
    }

    // Sort by score descending, take top N
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Theoretical max score for a project: the score if a hypothetical aide
   * matched every project label at confidence 1.0. Uses the same axis
   * weights as the total score so normalizedScore stays in [0, 1].
   */
  private computeProjectMax(
    pThematiques: Map<string, number>,
    pSites: Map<string, number>,
    pInterventions: Map<string, number>,
    projetThreshold: number,
    aideThreshold: number,
  ): number {
    return (
      this.WEIGHT_THEMATIQUES * this.axisMax(pThematiques, projetThreshold, aideThreshold) +
      this.WEIGHT_SITES * this.axisMax(pSites, projetThreshold, aideThreshold) +
      this.WEIGHT_INTERVENTIONS * this.axisMax(pInterventions, projetThreshold, aideThreshold)
    );
  }

  private axisMax(projectLabels: Map<string, number>, projetThreshold: number, aideThreshold: number): number {
    if (projectLabels.size === 0) return 0;
    const maxAideContribution = 1.0 - aideThreshold + this.SCORE_OFFSET;
    let sum = 0;
    for (const pScore of projectLabels.values()) {
      sum += (pScore - projetThreshold + this.SCORE_OFFSET) * maxAideContribution;
    }
    return sum / projectLabels.size;
  }

  /** Filter labels at or above the given confidence threshold. */
  private filterByThreshold(items: { label: string; score: number }[], threshold: number): Map<string, number> {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.score >= threshold) {
        map.set(item.label, item.score);
      }
    }
    return map;
  }

  /**
   * Find candidate aides that share at least one label with the project
   */
  private findCandidates(
    pTh: Map<string, number>,
    pSi: Map<string, number>,
    pIn: Map<string, number>,
    aidesScores: Map<string, AideClassification>,
    aideThreshold: number,
  ): Set<string> {
    const candidates = new Set<string>();
    const projectLabels = new Set([...pTh.keys(), ...pSi.keys(), ...pIn.keys()]);

    for (const [idAt, scores] of aidesScores) {
      const aideLabels = [
        ...scores.thematiques.filter((t) => t.score >= aideThreshold).map((t) => t.label),
        ...scores.sites.filter((s) => s.score >= aideThreshold).map((s) => s.label),
        ...scores.interventions.filter((i) => i.score >= aideThreshold).map((i) => i.label),
      ];

      for (const label of aideLabels) {
        if (projectLabels.has(label)) {
          candidates.add(idAt);
          break;
        }
      }
    }

    this.logger.log(`Found ${candidates.size} candidate aides for matching`);
    return candidates;
  }

  /**
   * Score one axis between a project and an aide
   * Formula: Σ((Sp - projetThreshold + offset) × (Sa - aideThreshold + offset)) / nbLabelsProjet
   */
  private scoreAxis(
    projectItems: Map<string, number>,
    aideItems: Map<string, number>,
    projetThreshold: number,
    aideThreshold: number,
  ): { score: number; commonLabels: string[] } {
    if (projectItems.size === 0) {
      return { score: 0, commonLabels: [] };
    }

    let totalScore = 0;
    const commonLabels: string[] = [];

    for (const [label, pScore] of projectItems) {
      const aScore = aideItems.get(label);
      if (aScore !== undefined) {
        const term = (pScore - projetThreshold + this.SCORE_OFFSET) * (aScore - aideThreshold + this.SCORE_OFFSET);
        totalScore += term;
        commonLabels.push(label);
      }
    }

    return {
      score: totalScore / projectItems.size,
      commonLabels,
    };
  }
}
