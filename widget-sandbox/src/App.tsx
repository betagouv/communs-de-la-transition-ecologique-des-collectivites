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

  return (
    <div className="fr-container">
      <h1>Widget Test Sandbox</h1>
      <ContextFilters filters={filters} onFiltersChange={setFilters} />
      <ServicesWidget isStagingEnv context={filters} />
    </div>
  );
}

export default App;
