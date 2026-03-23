/**
 * Matching engine for projects and aides
 *
 * Algorithm (from Gaëtan's match_projets_aides.py):
 *
 * Both projects and aides are pre-classified on 3 axes (thématiques, sites,
 * interventions), each label having a confidence score between 0 and 1.
 *
 * For each axis:
 *   1. Keep only labels with score ≥ 0.8 (high confidence)
 *   2. Find common labels between the project and the aide
 *   3. For each common label, compute:
 *        term = (score_project - 0.7) × (score_aide - 0.7)
 *      The -0.7 offset means:
 *        - A label at 0.8 (just above threshold) contributes 0.1 × ... (low weight)
 *        - A label at 1.0 (very confident) contributes 0.3 × ... (high weight)
 *   4. Axis score = sum(terms) / number of project labels on this axis
 *      Division normalizes so projects with fewer labels aren't penalized
 *
 * Total score = score_thématiques + score_sites + score_interventions
 *
 * Example:
 *   Project: "Isolation thermique" (0.95), "Rénovation énergétique" (0.85)
 *   Aide:    "Rénovation énergétique" (0.92)
 *   Common label: "Rénovation énergétique"
 *   Score = (0.85 - 0.7) × (0.92 - 0.7) / 2 = 0.15 × 0.22 / 2 = 0.0165
 */

import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";

interface ScoredLabels {
  thematiques: { label: string; score: number }[];
  sites: { label: string; score: number }[];
  interventions: { label: string; score: number }[];
}

export interface MatchResult {
  idAt: string;
  score: number;
  scoreThematiques: number;
  scoreSites: number;
  scoreInterventions: number;
  labelsCommuns: {
    thematiques: string[];
    sites: string[];
    interventions: string[];
  };
}

/**
 * Matching engine for projects and aides
 * Algorithm aligned with Gaëtan's match_projets_aides.py
 *
 * For each axis, score = Σ((score_projet - 0.7) × (score_aide - 0.7)) / nb_labels_projet
 * Total score = sum of 3 axis scores
 */
@Injectable()
export class AidesMatchingService {
  // Threshold and offset matching Gaëtan's script (THRESHOLD=80, OFFSET=10 on 0-100 scale)
  private readonly SCORE_THRESHOLD = 0.8;
  private readonly SCORE_OFFSET = 0.1;

  constructor(private readonly logger: CustomLogger) {}

  /**
   * Match a project against a set of classified aides
   * @param projetScores Classification scores of the project
   * @param aidesScores Map of aide id_at -> classification scores
   * @param limit Max number of results
   * @returns Sorted list of matching aides with scores
   */
  match(projetScores: ScoredLabels, aidesScores: Map<string, ScoredLabels>, limit = 10): MatchResult[] {
    // Filter project labels by threshold
    const pThematiques = this.filterByThreshold(projetScores.thematiques);
    const pSites = this.filterByThreshold(projetScores.sites);
    const pInterventions = this.filterByThreshold(projetScores.interventions);

    // Build inverted index for fast candidate lookup
    const candidates = this.findCandidates(pThematiques, pSites, pInterventions, aidesScores);

    // Score each candidate
    const results: MatchResult[] = [];

    for (const idAt of candidates) {
      const aideScores = aidesScores.get(idAt)!;

      const aThematiques = this.filterByThreshold(aideScores.thematiques);
      const aSites = this.filterByThreshold(aideScores.sites);
      const aInterventions = this.filterByThreshold(aideScores.interventions);

      const thResult = this.scoreAxis(pThematiques, aThematiques);
      const siResult = this.scoreAxis(pSites, aSites);
      const inResult = this.scoreAxis(pInterventions, aInterventions);

      const totalScore = thResult.score + siResult.score + inResult.score;

      if (totalScore > 0) {
        results.push({
          idAt,
          score: Math.round(totalScore * 100) / 100,
          scoreThematiques: Math.round(thResult.score * 100) / 100,
          scoreSites: Math.round(siResult.score * 100) / 100,
          scoreInterventions: Math.round(inResult.score * 100) / 100,
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
   * Filter labels above the threshold (matching Gaëtan's THRESHOLD=80 on 0-100 scale)
   */
  private filterByThreshold(items: { label: string; score: number }[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.score >= this.SCORE_THRESHOLD) {
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
    aidesScores: Map<string, ScoredLabels>,
  ): Set<string> {
    const candidates = new Set<string>();
    const projectLabels = new Set([...pTh.keys(), ...pSi.keys(), ...pIn.keys()]);

    for (const [idAt, scores] of aidesScores) {
      const aideLabels = [
        ...scores.thematiques.filter((t) => t.score >= this.SCORE_THRESHOLD).map((t) => t.label),
        ...scores.sites.filter((s) => s.score >= this.SCORE_THRESHOLD).map((s) => s.label),
        ...scores.interventions.filter((i) => i.score >= this.SCORE_THRESHOLD).map((i) => i.label),
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
   * Formula: Σ((Sp - threshold + offset) × (Sa - threshold + offset)) / Pt
   */
  private scoreAxis(
    projectItems: Map<string, number>,
    aideItems: Map<string, number>,
  ): { score: number; commonLabels: string[] } {
    if (projectItems.size === 0) {
      return { score: 0, commonLabels: [] };
    }

    let totalScore = 0;
    const commonLabels: string[] = [];

    for (const [label, pScore] of projectItems) {
      const aScore = aideItems.get(label);
      if (aScore !== undefined) {
        const term =
          (pScore - this.SCORE_THRESHOLD + this.SCORE_OFFSET) * (aScore - this.SCORE_THRESHOLD + this.SCORE_OFFSET);
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
