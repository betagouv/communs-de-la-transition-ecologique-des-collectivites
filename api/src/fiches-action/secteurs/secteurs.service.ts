import { Injectable } from "@nestjs/common";
import {
  MAPPING_LEVIERS,
  MAPPING_SITES,
  MAPPING_THEMATIQUES,
  SECTEURS,
  Secteur,
  SecteurParts,
} from "./secteurs-mapping.const";

export interface ScoredLabel {
  label: string;
  score: number;
}

export interface ClassificationInput {
  thematiques: ScoredLabel[];
  sites: ScoredLabel[];
}

export interface SecteurBreakdown {
  /** Secteur de masse maximale, null quand le non-attribuable domine. */
  dominant: Secteur | null;
  /** Part de masse non rattachable à un secteur (labels hors périmètre émissions). */
  nonAttribuable: number;
  /** Parts par secteur — parts + nonAttribuable somment à 1. */
  parts: Record<Secteur, number>;
}

export interface SecteursResult {
  direct: SecteurBreakdown | null;
  contribution: SecteurBreakdown | null;
}

/**
 * Affectation sectorielle déterministe d'une fiche action, à partir de ses labels
 * déjà persistés (classification LLM + leviers SGPE déclarés) et du mapping
 * label → secteurs de Jean Perret (secteurs-mapping.const.ts, utilisé verbatim).
 *
 * Agrégation : la formule EXACTE du reporting d'origine, identifiée depuis ses 36 711
 * sorties (100 % reproduites à ±1 point d'arrondi, dominant 99,7 %, sur les deux
 * sémantiques) :
 *   masse(secteur) = Σ thématiques score × part + 0.35 × Σ sites score × part
 *                  + 1.5 × Σ leviers part (les leviers ne sont pas scorés)
 *   nonAttribuable = 0.5 — constante de lissage : les labels non mappés et les parts
 *   résiduelles des vecteurs partiels sont IGNORÉS, seule cette masse fixe joue le
 *   rôle de seuil de significativité (une fiche dont aucun secteur ne dépasse 0.5 de
 *   masse pondérée est « non attribuable ») ;
 *   le tout est normalisé en simplexe (parts + nonAttribuable = 1), dominant = argmax.
 * Calculée à la lecture (aucune persistance) : reste synchrone avec les labels.
 */
@Injectable()
export class SecteursService {
  static readonly METHODE = "mapping-jean-v1.1/agregation-jean-v1";

  private static readonly POIDS_THEMATIQUE = 1;
  private static readonly POIDS_SITE = 0.35;
  private static readonly POIDS_LEVIER = 1.5;
  private static readonly LISSAGE_NON_ATTRIBUABLE = 0.5;

  computeSecteurs(classification: ClassificationInput | null, leviers: string[] | null): SecteursResult {
    return {
      direct: this.aggregate(classification, leviers, "direct"),
      contribution: this.aggregate(classification, leviers, "contribution"),
    };
  }

  private aggregate(
    classification: ClassificationInput | null,
    leviers: string[] | null,
    semantique: keyof SecteurParts,
  ): SecteurBreakdown | null {
    const masses = new Array<number>(SECTEURS.length).fill(0);
    const nonAttribuable = SecteursService.LISSAGE_NON_ATTRIBUABLE;
    let matched = false;

    const add = (label: string, score: number, poids: number, table: Record<string, SecteurParts>) => {
      const entry = table[normalizeLabel(label)];
      if (!entry) return;
      matched = true;
      const weight = poids * score;
      const parts = entry[semantique];
      for (let s = 0; s < SECTEURS.length; s++) {
        masses[s] += (weight * parts[s]) / 100;
      }
    };

    for (const { label, score } of classification?.thematiques ?? []) {
      add(label, score, SecteursService.POIDS_THEMATIQUE, MAPPING_THEMATIQUES);
    }
    for (const { label, score } of classification?.sites ?? []) {
      add(label, score, SecteursService.POIDS_SITE, MAPPING_SITES);
    }
    for (const label of leviers ?? []) {
      add(label, 1, SecteursService.POIDS_LEVIER, MAPPING_LEVIERS);
    }

    if (!matched) return null;
    const total = masses.reduce((a, b) => a + b, 0) + nonAttribuable;

    const parts = {} as Record<Secteur, number>;
    let dominant: Secteur | null = null;
    let max = nonAttribuable;
    for (let s = 0; s < SECTEURS.length; s++) {
      parts[SECTEURS[s]] = masses[s] / total;
      if (masses[s] > max) {
        max = masses[s];
        dominant = SECTEURS[s];
      }
    }
    return { dominant, nonAttribuable: nonAttribuable / total, parts };
  }
}

/** Lookup tolérant : minuscules, sans accents ni ponctuation (clés du mapping généré). */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
