import { useState } from "react";
import { ServicesWidget } from "@betagouv/les-communs-widget";
import { ContextFilters } from "./components/ContextFilters";
import { ContextFilters as ContextFiltersType } from "./types";
import Accordion from "@codegouvfr/react-dsfr/Accordion";

const FAKE_PROJECT_ID = "0195af1f-cf4c-7988-bc69-940b7ba76e1c";

function App() {
  const [debugMode, setDebugMode] = useState(false);
  const [filters, setFilters] = useState<ContextFiltersType>({
    competences: ["all"],
    leviers: ["all"],
    phases: ["Opération", "Idée", "Étude"],
    regions: ["all"],
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <Accordion label="Critères d'affichage">
        <ContextFilters
          filters={filters}
          onFiltersChange={setFilters}
          debugMode={debugMode}
          onDebugModeChange={setDebugMode}
        />
      </Accordion>

      {debugMode ? (
        <ServicesWidget isStagingEnv projectId={FAKE_PROJECT_ID} idType={"communId"} debug />
      ) : (
        <ServicesWidget isStagingEnv context={filters} />
      )}
    </div>
  );
}

export default App;
