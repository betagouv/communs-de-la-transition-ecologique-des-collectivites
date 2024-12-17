const mecStatusToGeneric = {
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
} as const;

const tetStatusToGeneric = {
  "A venir": "IDEE",
  "A discuter": "FAISABILITE",
  "En cours": "EN_COURS",
  "En retard": "IMPACTE",
  "En pause": "IMPACTE",
  Bloqué: "IMPACTE",
  Réalisé: "TERMINE",
  Abandonné: "ABANDONNE",
} as const;

const atStatusToGeneric = {
  "Réflexion / conception": "IDEE",
  "Mise en oeuvre / réalisation": "EN_COURS",
  "Usage / valorisation": "TERMINE",
} as const;

export const ServiceStatusMapping = {
  MEC: mecStatusToGeneric,
  Recoco: mecStatusToGeneric,
  TeT: tetStatusToGeneric,
  AT: atStatusToGeneric,
} as const;

type MECStatusType = keyof typeof mecStatusToGeneric;
type TeTStatusType = keyof typeof tetStatusToGeneric;
type ATStatusType = keyof typeof atStatusToGeneric;

export const MECStatus = Object.keys(mecStatusToGeneric);
export const TeTStatus = Object.keys(tetStatusToGeneric);
export const ATStatus = Object.keys(atStatusToGeneric);

export type ServicesProjectStatus = MECStatusType | TeTStatusType | ATStatusType;
