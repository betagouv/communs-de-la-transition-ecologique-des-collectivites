// Types for TC (Territoires Climat) opendata import

export const TC_BASE_URL = "https://www.territoires-climat.ademe.fr/opendata";

export const TC_FILES = {
  v1Entete: "Demarches_PCAET_V1_entete.csv",
  v2Entete: "Demarches_PCAET_V2_entete.csv",
  v1Actions: "Demarches_PCAET_Programme_Actions_V1.json",
  v2Actions: "Demarches_PCAET_Programme_Actions_V2.json",
  fichesAction: "Fiches_Action.csv",
} as const;

// CSV entête (semicolon-delimited, BOM)
export interface TcDemarcheCsv {
  Id: string;
  Date_creation: string;
  Date_modification: string;
  Date_lancement: string;
  Type_demarche: string;
  Nom: string;
  Description_rapide: string;
  "SIREN collectivites_coporteuses": string;
  "Collectivités porteuses": string;
  Population_couverte: string;
  Demarche_etat: string;
}

// JSON programme actions
export interface TcDemarcheActions {
  id: number;
  typesDemarche: Array<{ libcourt: string }>;
  actions: TcAction[];
}

export interface TcAction {
  intitule: string;
  secteurs: Array<{ secteur: { libelle: string } }>;
  volets: Array<{ libelle: string }>;
  typesPorteur: Array<{ libelle: string }>;
}

// Fiches_Action.csv enrichment
export interface TcFicheActionCsv {
  Id_action: string;
  Id_demarche: string;
  Nom_demarche: string;
  Intitule_action: string;
  Description_action: string;
  Date_lancement: string;
  Type_action: string;
  Cible_action: string;
}

// Parsed plan ready for DB insert
export interface ParsedPlan {
  nom: string;
  type: string;
  description: string | null;
  periodeDebut: string | null;
  periodeFin: string | null;
  collectiviteResponsableSiren: string | null;
  territoireCommunes: string[] | null;
  tcDemarcheId: number;
  tcVersion: string;
  tcEtat: string | null;
}

// Parsed fiche action ready for DB insert
export interface ParsedFicheAction {
  nom: string;
  description: string | null;
  collectiviteResponsableSiren: string | null;
  territoireCommunes: string[] | null;
  tcDemarcheId: number;
  tcHash: string;
  tcSecteurs: string[] | null;
  tcTypesPorteur: string[] | null;
  tcVolets: string[] | null;
  tcTypeAction: string | null;
  tcCibleAction: string | null;
}

export interface ImportStats {
  plansInserted: number;
  plansUpdated: number;
  fichesInserted: number;
  fichesUpdated: number;
  linksCreated: number;
  fichesEnriched: number;
  communesResolved: number;
}
