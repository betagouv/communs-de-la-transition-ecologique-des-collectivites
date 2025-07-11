import { useState } from "react";
import { ServicesWidget } from "@betagouv/les-communs-widget";
import { ContextFilters } from "./components/ContextFilters";
import { ContextFilters as ContextFiltersType } from "./types";

function App() {
  const [filters, setFilters] = useState<ContextFiltersType>({
    competences: ["all"],
    leviers: ["all"],
    phases: ["Opération", "Idée", "Étude"],
  });

  // Vérifier si des filtres sont actifs
  const hasActiveFilters = filters.competences.length > 0 || filters.leviers.length > 0 || filters.phases.length > 0;

  return (
    <div className="fr-container">
      <h1>Widget Test Sandbox</h1>
      <ContextFilters filters={filters} onFiltersChange={setFilters} />
      <ServicesWidget isStagingEnv context={filters} />
      Affichage du contexte sélectionné
      {hasActiveFilters && (
        <div className="fr-alert fr-alert--info fr-mt-4w">
          <p className="fr-alert__title">Contexte sélectionné (non appliqué pour l&apos;instant)</p>
          <div className="fr-alert__content">
            <p className="fr-text--sm">
              <strong>Compétences :</strong>{" "}
              {filters.competences.length > 0 ? filters.competences.join(", ") : "Aucune"}
            </p>
            <p className="fr-text--sm">
              <strong>Leviers :</strong> {filters.leviers.length > 0 ? filters.leviers.join(", ") : "Aucun"}
            </p>
            <p className="fr-text--sm">
              <strong>Phases :</strong> {filters.phases.length > 0 ? filters.phases.join(", ") : "Aucune"}
            </p>
            <p className="fr-text--sm fr-mt-2w">
              <em>Note : Le mode contexte nécessite une version plus récente du widget.</em>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
