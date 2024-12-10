import { ServiceType } from "@/shared/types";
import { ProjectStatus } from "@database/schema";

interface StatusMapping {
  serviceStatus: string;
  genericStatus: ProjectStatus;
}

export const MECStatusMapping: StatusMapping[] = [
  { serviceStatus: "Non démarré, intention", genericStatus: "IDEE" },
  {
    serviceStatus: "Etudes pré-opérationnelles non initiées",
    genericStatus: "IDEE",
  },
  {
    serviceStatus: "Etudes pré-opérationnelles en cours",
    genericStatus: "FAISABILITE",
  },
  {
    serviceStatus: "Etudes pré-opérationnelles terminées",
    genericStatus: "FAISABILITE",
  },
  {
    serviceStatus: "Etudes opérationnelles non initiées",
    genericStatus: "FAISABILITE",
  },
  {
    serviceStatus: "Etudes opérationnelles en cours",
    genericStatus: "EN_COURS",
  },
  {
    serviceStatus: "Etudes opérationnelles terminées",
    genericStatus: "EN_COURS",
  },
  { serviceStatus: "Opération démarrée", genericStatus: "EN_COURS" },
  { serviceStatus: "Opération terminée, livrée", genericStatus: "TERMINE" },
  {
    serviceStatus: "Opération abandonnée, annulée",
    genericStatus: "ABANDONNE",
  },
  { serviceStatus: "Opération en pause, reportée", genericStatus: "IMPACTE" },
];

export const TeTStatusMapping: StatusMapping[] = [
  { serviceStatus: "A venir", genericStatus: "IDEE" },
  { serviceStatus: "A discuter", genericStatus: "FAISABILITE" },
  { serviceStatus: "En cours", genericStatus: "EN_COURS" },
  { serviceStatus: "En retard", genericStatus: "IMPACTE" },
  { serviceStatus: "En pause", genericStatus: "IMPACTE" },
  { serviceStatus: "Bloqué", genericStatus: "IMPACTE" },
  { serviceStatus: "Réalisé", genericStatus: "TERMINE" },
  { serviceStatus: "Abandonné", genericStatus: "ABANDONNE" },
];

export const ATStatusMapping: StatusMapping[] = [
  { serviceStatus: "Réflexion / conception", genericStatus: "IDEE" },
  { serviceStatus: "Mise en oeuvre / réalisation", genericStatus: "EN_COURS" },
  { serviceStatus: "Usage / valorisation", genericStatus: "TERMINE" },
];

export const StatusMappings: Record<ServiceType, StatusMapping[]> = {
  MEC: MECStatusMapping,
  Recoco: MECStatusMapping,
  TeT: TeTStatusMapping,
};
