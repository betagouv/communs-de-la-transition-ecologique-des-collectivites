/**
 * Miroir des DTO de `api/src/admin/dto/admin.dto.ts`.
 *
 * Recopiés, et non importés : ce back-office ne doit avoir AUCUNE dépendance vers l'API — on
 * veut pouvoir supprimer ce dossier sans rien changer côté API, et réciproquement. Le prix, c'est
 * ce fichier à tenir à jour ; le bénéfice, c'est qu'il n'y a rien à défaire le jour où on jette
 * ce test.
 */

export type Axe = "thematiques" | "sites" | "interventions";

/** Les trois axes, et leurs libellés. Une seule définition : ils étaient recopiés dans quatre
 *  fichiers, et les deux tables de libellés avaient déjà divergé (singulier contre pluriel). */
export const AXES: Axe[] = ["thematiques", "sites", "interventions"];

export const LIBELLE_AXE: Record<Axe, { singulier: string; pluriel: string }> = {
  thematiques: { singulier: "thématique", pluriel: "Thématiques" },
  sites: { singulier: "lieu", pluriel: "Lieux" },
  interventions: { singulier: "modalité", pluriel: "Modalités" },
};

export interface EtiquetteScoree {
  label: string;
  score: number;
}

export type Classification = Record<Axe, EtiquetteScoree[]>;
export type EtiquettesCommunes = Record<Axe, string[]>;

export interface Seuils {
  pertinence: number;
}

/** Une étiquette que le projet ne porte PAS — c'est ce qui explique un questionnaire non proposé. */
export interface EtiquetteManquante {
  axe: Axe;
  label: string;
}

export interface RecommandationSimulee {
  id: string;
  titre: string;
  inconditionnelle: boolean;
  declenchee: boolean;
}

export interface QuestionnaireSimule {
  slug: string;
  retenu: boolean;
  /** Vide = proposé. Sinon, exactement ce qui manque au projet. */
  etiquettesManquantes: EtiquetteManquante[];
  statut: "non_commence" | "en_cours" | "termine";
  reponses: Record<string, string>;
  recommandations: RecommandationSimulee[];
}

export interface ServiceSimule {
  slug: string;
  nom: string;
  scoreBrut: number;
  facteurPhase: number;
  score: number;
  retenu: boolean;
  etiquettesCommunes: EtiquettesCommunes;
  profilGeneraliste: string | null;
  categories: string[];
}

/**
 * Rejoue la sélection du serveur à un seuil arbitraire.
 *
 * C'est LA raison d'être de cet écran. `/admin/simuler` renvoie tous les candidats avec leur
 * score, jamais seulement les retenus : déplacer le seuil est donc de l'arithmétique côté
 * navigateur, sans rappeler l'API. On voit l'effet d'un réglage avant de le figer dans le code.
 *
 * Le score seul décide — il n'y a pas de repêchage. Cette fonction doit rester la copie exacte
 * de la règle appliquée dans api/src/services-numeriques/services-numeriques.service.ts, sinon
 * l'écran ment sur ce que verra la collectivité.
 */
export const retenuAuSeuil = (service: ServiceSimule, seuil: number): boolean => service.score >= seuil;

export interface ProjetSimule {
  id: string;
  nom: string;
  phase: string | null;
  classificationScores: Classification | null;
  avertissement: string | null;
}

export interface Simulation {
  projet: ProjetSimule;
  questionnaires: QuestionnaireSimule[];
  services: ServiceSimule[];
  seuils: Seuils;
}

/** Les taxonomies fermées, servies par l'API. Jamais recopiées ici : une copie dérive. */
export type Taxonomies = Record<Axe, string[]>;

export interface QuestionDef {
  id: string;
  type: string;
  intitule: string;
  options: { id: string; libelle: string; signal?: string; aide?: string }[];
}

export interface RecommandationDef {
  id: string;
  titre: string;
  description?: string;
  condition: true | { question: string; parmi: string[] };
  [autre: string]: unknown;
}

export interface QuestionnaireContenu {
  slug: string;
  libelle: string;
  version: number;
  banniere: { icone?: string; titre?: string; sousTitre?: string };
  etiquettesRequises: Taxonomies;
  questions: QuestionDef[];
  recommandations: RecommandationDef[];
}

/** Le document ENTIER, tel qu'il part en PUT. Pas de PATCH : voir admin.controller.ts. */
export interface QuestionnaireEdition {
  sourceNom: string;
  banniere: QuestionnaireContenu["banniere"];
  questions: QuestionDef[];
  recommandations: RecommandationDef[];
  etiquettesRequises: Taxonomies;
  editePar?: string;
}

export interface ServiceContenu {
  slug: string;
  nom: string;
  profilGeneraliste: string | null;
  presentationGenerique: string | null;
  categories: string[];
  niveauExpertise: string | null;
  classification: Classification;
  phases: Record<string, number>;
  logoUrl: string | null;
}

export interface Contenu {
  questionnaires: QuestionnaireContenu[];
  services: ServiceContenu[];
  seuils: Seuils;
}

/** Compte les étiquettes d'une classification, tous axes confondus. */
export const compterEtiquettes = (c: Classification | EtiquettesCommunes | null): number =>
  c ? c.thematiques.length + c.sites.length + c.interventions.length : 0;

/** Les étiquettes d'un match, à plat, dans l'ordre de poids des axes. */
export const aplatir = (c: EtiquettesCommunes): string[] => [...c.thematiques, ...c.sites, ...c.interventions];
