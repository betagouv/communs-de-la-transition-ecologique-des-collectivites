import { ProjetPhase } from "@database/schema";

// ============================================================
// Contrat du catalogue de services numériques (benchmark DINUM)
// ============================================================

/** §4 de la spec : nature du service. Un service peut en cumuler plusieurs. */
export const CATEGORIES = ["expert", "contenu", "inspirants", "discussions", "conseil", "aides"] as const;
export type Categorie = (typeof CATEGORIES)[number];

export const NIVEAUX_EXPERTISE = ["bas", "moyen", "haut"] as const;
export type NiveauExpertise = (typeof NIVEAUX_EXPERTISE)[number];

/** Valeurs ternaires du benchmark, normalisées (le fichier mélange « Oui » et « oui »). */
export const TERNAIRES = ["oui", "non", "eventuellement"] as const;
export type Ternaire = (typeof TERNAIRES)[number];

// ------------------------------------------------------------
// Phases
// ------------------------------------------------------------

/**
 * Le benchmark porte 5 colonnes de phase, l'API en connaît 3 (Idée, Étude, Opération).
 * Deux colonnes ne décrivent pas un projet mais la collectivité — « Mieux saisir son
 * territoire » et « Construire un plan global » (cette dernière n'a d'ailleurs qu'un seul
 * « Oui » dans tout le fichier) : elles sont délibérément IGNORÉES, faute de correspondance
 * avec la phase d'un projet.
 *
 * Le poids retenu pour une phase projet est le MAXIMUM des colonnes qui y contribuent.
 */
export const COLONNES_PHASE: Record<string, ProjetPhase[]> = {
  "Phase : Affiner un projet au stade de l’idée vague": ["Idée"],
  "Phase : Concrétiser un projet qui prend forme": ["Étude", "Opération"],
  "Gestion quotidienne et opérationnelle de la collectivité": ["Opération"],
};

/** « Oui » / « Un peu » / « Non » → poids. */
export const POIDS_PHASE: Record<string, number> = { oui: 1, "un peu": 0.5, non: 0 };

export type PoidsParPhase = Partial<Record<ProjetPhase, number>>;

/**
 * Facteur appliqué au score de pertinence selon la phase du projet.
 *
 * La phase MODULE le score, elle n'exclut jamais : un service très pertinent
 * thématiquement mais mal phasé descend dans la liste, il ne disparaît pas. D'où un facteur
 * borné à [0.5, 1] plutôt qu'une multiplication par le poids brut (qui annulerait un « Non »).
 *
 * Donnée absente (le benchmark n'est rempli qu'à 60 % sur ces colonnes) ou projet sans phase
 * → facteur neutre : on ne pénalise pas un service pour une information qu'on n'a pas.
 */
export function facteurPhase(phases: PoidsParPhase, phaseProjet: ProjetPhase | null): number {
  if (!phaseProjet) return 1;
  const poids = phases[phaseProjet];
  if (poids === undefined) return 1;
  return 0.5 + 0.5 * poids;
}

/**
 * Score normalisé minimal pour qu'un service soit jugé PERTINENT. Même échelle que le
 * `cutoff` des aides et le seuil des questionnaires.
 *
 * En dessous, le service n'est pas affiché. Point. Il n'y a pas de repêchage : sur trois projets
 * réels de staging, ce seuil sépare proprement (0,64 pour Bénéfriches sur une friche ; 0,03 pour
 * EnvErgo sur un espace commercial).
 *
 * Les services du benchmark sans thématique fine scoreront donc zéro à jamais et resteront
 * invisibles. C'est un défaut de DONNÉES, à corriger dans le benchmark — pas à masquer par une
 * règle d'affichage qui noierait les services réellement pertinents.
 */
export const SEUIL_PERTINENCE = 0.3;
