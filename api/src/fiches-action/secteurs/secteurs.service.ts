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
 * Agrégation (v1, documentée — la formule exacte du reporting d'origine n'est pas
 * dans l'artefact ; celle-ci en reproduit la présence par secteur à ~96 %) :
 *   masse(secteur) = Σ label poids(type) × score(label) × part(label, secteur)
 *   poids : thématique 1, site 0.35, levier 1.5 (ajustés sur le corpus du reporting) ;
 *   le résidu des labels sans secteur (vecteur nul ou partiel) alimente nonAttribuable ;
 *   le tout est normalisé en simplexe (parts + nonAttribuable = 1).
 * Calculée à la lecture (aucune persistance) : reste synchrone avec les labels.
 */
@Injectable()
export class SecteursService {
  static readonly METHODE = "mapping-jean-v1/agregation-v1";

  private static readonly POIDS_THEMATIQUE = 1;
  private static readonly POIDS_SITE = 0.35;
  private static readonly POIDS_LEVIER = 1.5;

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
    let nonAttribuable = 0;
    let matched = false;

    const add = (label: string, score: number, poids: number, table: Record<string, SecteurParts>) => {
      const entry = table[normalizeLabel(label)];
      if (!entry) return;
      matched = true;
      const weight = poids * score;
      const parts = entry[semantique];
      let attributed = 0;
      for (let s = 0; s < SECTEURS.length; s++) {
        masses[s] += (weight * parts[s]) / 100;
        attributed += parts[s];
      }
      nonAttribuable += weight * (1 - attributed / 100);
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

    const total = masses.reduce((a, b) => a + b, 0) + nonAttribuable;
    if (!matched || total <= 0) return null;

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
