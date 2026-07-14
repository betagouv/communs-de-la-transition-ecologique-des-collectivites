import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AidesMatchingService } from "./aides-matching.service";
import { AidesTextualMatchingService } from "./aides-textual-matching.service";
import { Aide, AideClassification, AideMatchResult, AideWithClassification, AidesListResponse } from "./dto/aides.dto";

/**
 * LE MOTEUR : scorer et classer des aides contre une classification. Rien d'autre.
 *
 * Il vivait en privé dans AidesController. Extrait parce qu'il a désormais TROIS appelants —
 * `GET /aides`, `POST /aides/recherche`, et la simulation du back-office. Le recopier pour le
 * troisième aurait donné deux implémentations d'une même règle, qui divergent : c'est exactement
 * ce que la revue a reproché à la fusion des ajouts manuels, écrite deux fois et déjà divergente
 * au bout d'un jour.
 *
 * PUR. Il ne connaît ni les ajouts manuels (qui s'appliquent SUR son résultat), ni les projets, ni
 * les périmètres. Il prend une classification et une liste d'aides, il rend un classement.
 */

/** Pondération du score combiné quand le matching textuel est actif. */
const W_THEMATIC = 0.85;
const W_TEXTUAL = 0.15;

/**
 * Plancher de « repêchage » textuel : une aide sans aucun match thématique remonte quand même si
 * son score textuel dépasse ce seuil. Sans lui, une aide non encore classifiée serait invisible
 * même quand son intitulé colle parfaitement au projet.
 */
const MIN_TEXTUAL_RESCUE = 0.35;

export interface ReglagesMoteur {
  maxResults: number;
  /** Score minimal pour qu'une aide soit retenue. 0 = aucun filtrage. */
  cutoff: number;
  /** Confiance minimale d'une étiquette pour compter. `undefined` = le défaut du matcher (0.8). */
  thresholds: { projet?: number; aide?: number };
  textualEnabled: boolean;
  textualText: string;
}

@Injectable()
export class AidesMoteurService {
  constructor(
    private readonly matchingService: AidesMatchingService,
    private readonly textualMatchingService: AidesTextualMatchingService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Le matching textuel est opt-in : override par requête, sinon le drapeau d'environnement.
   * Exposé pour que la simulation du back-office applique la MÊME règle par défaut que l'API.
   */
  textuelActif(override?: string | boolean): boolean {
    if (override === true || override === "true") return true;
    if (override === false || override === "false") return false;
    return this.configService.get<string>("AIDES_TEXTUAL_MATCHING_ENABLED") === "true";
  }

  /**
   * Matching thématique (+ textuel optionnel), enrichissement et tri.
   *
   * `total` reflète le nombre d'aides du périmètre AVANT filtrage : c'est ce qui permet de
   * distinguer « aucune aide sur ce territoire » de « des aides existent, aucune ne colle ».
   */
  classer(
    scores: AideClassification,
    allAides: Aide[],
    classifications: Map<string, AideClassification>,
    reglages: ReglagesMoteur,
  ): AidesListResponse {
    const { maxResults, cutoff, thresholds, textualEnabled, textualText } = reglages;

    // On passe allAides.length : ne rien pré-trancher avant la combinaison textuelle optionnelle.
    const matchResults = new Map<string, AideMatchResult>();
    for (const r of this.matchingService.match(scores, classifications, allAides.length, thresholds)) {
      matchResults.set(r.idAt, r);
    }

    // Le textuel tourne sur TOUTES les aides du périmètre, y compris celles non classifiées —
    // c'est précisément ce qui permet de les repêcher.
    const textualResults = textualEnabled ? this.textualMatchingService.score(textualText, allAides) : null;

    let enriched: AideWithClassification[] = allAides.map((aide) => {
      const idAt = String(aide.id);
      const match = matchResults.get(idAt);

      const base: AideWithClassification = {
        ...aide,
        classification: classifications.get(idAt),
        matchingScore: match?.score,
        normalizedScore: match?.normalizedScore,
        axesMatched: match?.axesMatched,
        labelsCommuns: match?.labelsCommuns,
      };

      if (!textualResults) return base;

      const textual = textualResults.get(idAt);
      return {
        ...base,
        textualScore: textual?.score ?? 0,
        combinedScore: W_THEMATIC * (match?.normalizedScore ?? 0) + W_TEXTUAL * (textual?.score ?? 0),
        matchedTerms: textual?.matchedTerms,
      };
    });

    if (textualEnabled) {
      enriched = enriched
        .filter(
          (a) =>
            (a.matchingScore !== undefined || (a.textualScore ?? 0) >= MIN_TEXTUAL_RESCUE) &&
            (a.combinedScore ?? 0) >= cutoff,
        )
        .sort((a, b) => (b.combinedScore ?? 0) - (a.combinedScore ?? 0))
        .slice(0, maxResults);
    } else {
      enriched = enriched
        .filter((a) => a.matchingScore !== undefined && (a.normalizedScore ?? 0) >= cutoff)
        .sort((a, b) => (b.matchingScore ?? 0) - (a.matchingScore ?? 0))
        .slice(0, maxResults);
    }

    if (enriched.length === 0) {
      return { status: "no_match", aides: [], total: allAides.length };
    }

    return { status: "ok", aides: enriched, total: allAides.length };
  }
}
