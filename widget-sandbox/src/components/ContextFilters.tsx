import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { CompetencesFilter } from "./CompetencesFilter";
import { LeviersFilter } from "./LeviersFilter";
import { PhasesFilter } from "./PhasesFilter";
import { FilterProps, ContextFilters as ContextFiltersType } from "../types";

interface ContextFiltersProps extends FilterProps {
  debugMode: boolean;
  onDebugModeChange: (debugMode: boolean) => void;
}

export const ContextFilters = ({ filters, onFiltersChange, debugMode, onDebugModeChange }: ContextFiltersProps) => {
  const handleCompetencesChange = (competences: ContextFiltersType["competences"]) => {
    onFiltersChange({
      ...filters,
      competences,
    });
  };

  const handleLeviersChange = (leviers: ContextFiltersType["leviers"]) => {
    onFiltersChange({
      ...filters,
      leviers,
    });
  };

  const handlePhasesChange = (phases: ContextFiltersType["phases"]) => {
    onFiltersChange({
      ...filters,
      phases,
    });
  };

  const handleReset = () => {
    onFiltersChange({
      competences: ["all"],
      leviers: ["all"],
      phases: ["Opération", "Idée", "Étude"],
    });
  };

  const hasActiveFilters = filters.competences.length > 0 || filters.leviers.length > 0 || filters.phases.length > 0;

  return (
    <div className={fr.cx("fr-container", "fr-mb-4w")}>
      <div className={fr.cx("fr-card", "fr-p-4w")}>
        <div className={fr.cx("fr-card__header")}>
          <div className={fr.cx("fr-grid-row", "fr-grid-row--middle")} style={{ justifyContent: "space-between" }}>
            <div>
              <h2 className={fr.cx("fr-card__title", "fr-h4")}>Filtres de contexte</h2>
              <p className={fr.cx("fr-card__desc", "fr-text--sm")}>
                Sélectionnez les compétences, leviers et phases pour personnaliser les services affichés
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button priority="primary" onClick={() => onDebugModeChange(!debugMode)} size="small">
                {debugMode ? "Afficher les services en fonction du contexte" : "Afficher tous les services"}
              </Button>
              <Button priority="secondary" onClick={handleReset} disabled={!hasActiveFilters} size="small">
                Réinitialiser
              </Button>
            </div>
          </div>
        </div>

        <div className={fr.cx("fr-card__body")}>
          <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
            <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
              <CompetencesFilter value={filters.competences} onChange={handleCompetencesChange} />
            </div>

            <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
              <LeviersFilter value={filters.leviers} onChange={handleLeviersChange} />
            </div>
          </div>
          <PhasesFilter value={filters.phases} onChange={handlePhasesChange} />

          {hasActiveFilters && (
            <div className={fr.cx("fr-mt-3w", "fr-alert", "fr-alert--info")}>
              <p className={fr.cx("fr-alert__title")}>Contexte sélectionné</p>
              <div className="fr-alert__content">
                <p className={fr.cx("fr-text--sm")}>
                  <strong>Compétences :</strong>{" "}
                  {filters.competences.length > 0 ? filters.competences.join(", ") : "Aucune"}
                </p>
                <p className={fr.cx("fr-text--sm")}>
                  <strong>Leviers :</strong> {filters.leviers.length > 0 ? filters.leviers.join(", ") : "Aucun"}
                </p>
                <p className={fr.cx("fr-text--sm")}>
                  <strong>Phases :</strong> {filters.phases.length > 0 ? filters.phases.join(", ") : "Aucune"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
