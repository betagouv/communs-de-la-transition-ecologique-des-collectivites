import { leviers } from "../const/leviers";
import { competenceCodes, competencesFromM57Referentials } from "../const/competences";

// Types de base
export type ServiceType = "MEC" | "TeT" | "Recoco";
export type ServiceTypeIds = "mecId" | "tetId" | "recocoId";

// Types pour les compétences
export type CompetenceCode = (typeof competenceCodes)[number];
export type CompetenceCodes = CompetenceCode[];
export type CompetenceName = (typeof competencesFromM57Referentials)[CompetenceCode];

// Types pour les leviers
export type Levier = (typeof leviers)[number];
export type Leviers = Levier[];

// Types pour les IDs
export const idTypes = ["communId", "tetId"] as const;
export type IdType = (typeof idTypes)[number];

// Types pour les phases de projet
export const projetPhases = ["Idée", "Étude", "Réalisation", "Exploitation"] as const;
export type ProjetPhase = (typeof projetPhases)[number];

// Types pour les phases de statut
export const phaseStatuts = ["En cours", "Terminé", "Abandonné"] as const;
export type PhaseStatut = (typeof phaseStatuts)[number];

// Export des constantes
export { leviers, competenceCodes, competencesFromM57Referentials }; 