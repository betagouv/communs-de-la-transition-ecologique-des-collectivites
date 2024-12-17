import { ProjectStatus } from "@database/schema";

const mecStatusToGeneric: Record<MECStatus, ProjectStatus> = {
  "Non démarré, intention": "IDEE",
  "Etudes pré-opérationnelles non initiées": "IDEE",
  "Etudes pré-opérationnelles en cours": "FAISABILITE",
  "Etudes pré-opérationnelles terminées": "FAISABILITE",
  "Etudes opérationnelles non initiées": "FAISABILITE",
  "Etudes opérationnelles en cours": "EN_COURS",
  "Etudes opérationnelles terminées": "EN_COURS",
  "Opération démarrée": "EN_COURS",
  "Opération terminée, livrée": "TERMINE",
  "Opération abandonnée, annulée": "ABANDONNE",
  "Opération en pause, reportée": "IMPACTE",
};

const tetStatusToGeneric: Record<TeTStatus, ProjectStatus> = {
  "A venir": "IDEE",
  "A discuter": "FAISABILITE",
  "En cours": "EN_COURS",
  "En retard": "IMPACTE",
  "En pause": "IMPACTE",
  Bloqué: "IMPACTE",
  Réalisé: "TERMINE",
  Abandonné: "ABANDONNE",
};

const atStatusToGeneric: Record<ATStatus, ProjectStatus> = {
  "Réflexion / conception": "IDEE",
  "Mise en oeuvre / réalisation": "EN_COURS",
  "Usage / valorisation": "TERMINE",
};

export const ServiceStatusMapping = {
  MEC: mecStatusToGeneric,
  Recoco: mecStatusToGeneric,
  TeT: tetStatusToGeneric,
  AT: atStatusToGeneric,
} as const;

export const MECStatuses = [
  "Non démarré, intention",
  "Etudes pré-opérationnelles non initiées",
  "Etudes pré-opérationnelles en cours",
  "Etudes pré-opérationnelles terminées",
  "Etudes opérationnelles non initiées",
  "Etudes opérationnelles en cours",
  "Etudes opérationnelles terminées",
  "Opération démarrée",
  "Opération terminée, livrée",
  "Opération abandonnée, annulée",
  "Opération en pause, reportée",
] as const;

export const TeTStatuses = [
  "A venir",
  "A discuter",
  "En cours",
  "En retard",
  "En pause",
  "Bloqué",
  "Réalisé",
  "Abandonné",
] as const;

export const ATStatuses = ["Réflexion / conception", "Mise en oeuvre / réalisation", "Usage / valorisation"] as const;

type MECStatus = (typeof MECStatuses)[number];
type TeTStatus = (typeof TeTStatuses)[number];
type ATStatus = (typeof ATStatuses)[number];

export type ServicesProjectStatus = MECStatus | TeTStatus | ATStatus;
