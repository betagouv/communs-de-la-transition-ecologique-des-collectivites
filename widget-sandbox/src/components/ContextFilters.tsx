import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { CompetencesFilter } from "./CompetencesFilter";
import { LeviersFilter } from "./LeviersFilter";
import { PhasesFilter } from "./PhasesFilter";
import { RegionsFilter } from "./RegionsFilter";
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

  const handleRegionsChange = (regions: ContextFiltersType["regions"]) => {
    onFiltersChange({
      ...filters,
      regions,
    });
  };

  const handleReset = () => {
    onFiltersChange({
      competences: ["all"],
      leviers: ["all"],
      phases: ["Opération", "Idée", "Étude"],
      regions: ["all"],
    });
  };

  const hasActiveFilters =
    filters.competences.length > 0 ||
    filters.leviers.length > 0 ||
    filters.phases.length > 0 ||
    filters.regions.length > 0;

  return (
    <div className={fr.cx("fr-mb-4w")}>
      <div className={fr.cx("fr-card", "fr-p-4w")}>
        <div className={fr.cx("fr-card__header")}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <h2 className={fr.cx("fr-card__title", "fr-h4")}>Critères d&#39;affichage</h2>
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
          <p className={fr.cx("fr-card__desc", "fr-text--sm", "fr-mb-2w")}>
            Sélectionnez les compétences, leviers, phases et régions pour personnaliser les services affichés. Cet
            encart ne fait pas partie du widget, mais permet de visualiser l&#39;affichage de services en fonction du
            contexte choisi.
          </p>
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
          <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
            <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
              <PhasesFilter value={filters.phases} onChange={handlePhasesChange} />
            </div>
            <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
              <RegionsFilter value={filters.regions} onChange={handleRegionsChange} />
            </div>
          </div>

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
                <p className={fr.cx("fr-text--sm")}>
                  <strong>Régions :</strong> {filters.regions.length > 0 ? filters.regions.join(", ") : "Aucune"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
