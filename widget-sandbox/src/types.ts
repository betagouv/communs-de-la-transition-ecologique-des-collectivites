import { CompetenceCodes, Leviers, ProjetPhases } from "@betagouv/les-communs-widget";
// Types basés sur ceux du widget

export interface ContextFilters {
  competences: CompetenceCodes;
  leviers: Leviers;
  phases: ProjetPhases;
}

export interface FilterProps {
  filters: ContextFilters;
  onFiltersChange: (filters: ContextFilters) => void;
}
