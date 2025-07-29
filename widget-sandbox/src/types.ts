import { CompetenceCodes, Leviers, ProjetPhases, RegionCodes } from "@betagouv/les-communs-widget";

export interface ContextFilters {
  competences: CompetenceCodes;
  leviers: Leviers;
  phases: ProjetPhases;
  regions: RegionCodes;
}

export interface FilterProps {
  filters: ContextFilters;
  onFiltersChange: (filters: ContextFilters) => void;
}
