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
 * Le score et le verdict viennent du SERVEUR. On ne rejoue rien ici.
 *
 * Une version précédente de cet écran recalculait `retenu` dans le navigateur, avec un curseur de
 * seuil : c'était une COPIE de la décision de l'API, et une copie diverge. L'aperçu montre
 * désormais ce que l'API renvoie réellement ; ce panneau-ci ne sert plus qu'au DIAGNOSTIC — voir
 * les candidats écartés et leur score, tels que le serveur les a calculés.
 */

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

// ------------------------------------------------------------
// L'APERÇU : ce que l'API renvoie RÉELLEMENT à une plateforme.
//
// PAS UNE ÉMULATION. Ces quatre sections sont les réponses EXACTES des endpoints publics — le
// back-office ne rejoue aucune règle. Une reconstitution, même fidèle au départ, finit par
// diverger, et un outil qui ment sur ce que voit la collectivité est pire que pas d'outil.
// ------------------------------------------------------------

/** Réglages de GET /aides. Un champ absent = « le défaut de l'API ». */
export interface ReglagesAides {
  limit?: number;
  cutoff?: number;
  projetThreshold?: number;
  aideThreshold?: number;
  textual?: boolean;
  texte?: string;
}

export interface AideRendue {
  id: number;
  name: string;
  url?: string;
  normalizedScore?: number;
  textualScore?: number;
  combinedScore?: number;
  labelsCommuns?: EtiquettesCommunes;
  ajoutManuel?: { decisionId: string; message?: string; plateforme: string; date: string };
}

export interface ServiceRendu {
  id: string;
  nom: string;
  description: string;
  categories: string[];
  ajoutManuel?: { decisionId: string; message?: string; plateforme: string; horsCatalogue?: boolean };
}

export interface QuestionnaireRendu {
  slug: string;
  version: number;
  statut: string;
  banniere: { titre?: string; sousTitre?: string };
  questions: { id: string; intitule: string }[];
}

export interface RecommandationRendue {
  id: string;
  titre: string;
  description?: string;
  financements?: { libelle: string; url: string; aideId?: number }[];
}

export interface Apercu {
  aides: { status: string; total: number; aides: AideRendue[] };
  services: { services: ServiceRendu[] };
  questionnaires: { questionnaires: QuestionnaireRendu[] };
  recommandations: { recommandations: RecommandationRendue[] };
  /** Les réglages d'aides RÉELLEMENT appliqués — défauts de l'API résolus. */
  reglagesAides: {
    maxResults?: number;
    cutoff?: number;
    thresholds?: { projet?: number; aide?: number };
    textualEnabled?: boolean;
  };
  /** Le seuil de services RÉELLEMENT appliqué par l'API. */
  seuilServices: number;
}
