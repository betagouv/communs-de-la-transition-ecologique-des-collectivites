import { useState } from "react";
import { ServicesWidget } from "@betagouv/les-communs-widget";
import { ContextFilters } from "./components/ContextFilters";
import { ContextFilters as ContextFiltersType } from "./types";

const FAKE_PROJECT_ID = "0195af1f-cf4c-7988-bc69-940b7ba76e1c";

function App() {
  const [debugMode, setDebugMode] = useState(false);
  const [filters, setFilters] = useState<ContextFiltersType>({
    competences: ["all"],
    leviers: ["all"],
    phases: ["Opération", "Idée", "Étude"],
  });

  return (
    <div className="fr-container">
      <ContextFilters
        filters={filters}
        onFiltersChange={setFilters}
        debugMode={debugMode}
        onDebugModeChange={setDebugMode}
      />
      {debugMode ? (
        <ServicesWidget isStagingEnv projectId={FAKE_PROJECT_ID} idType={"communId"} debug />
      ) : (
        <ServicesWidget isStagingEnv context={filters} />
      )}
    </div>
  );
}

export default App;
