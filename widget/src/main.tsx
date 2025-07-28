import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";
import { CompetenceCodes, Leviers, ProjetPhases, RegionCodes, ServicesWidget } from "../lib";

startReactDsfr({ defaultColorScheme: "system" });

//const PROJECT_ID_WITHOUT_EXTRAFIELD = "0197e4c8-ff96-7041-8dd5-3603b447f6c0";

const context = {
  competences: ["all"] as CompetenceCodes,
  leviers: ["all"] as Leviers,
  phases: ["Opération", "Idée", "Étude"] as ProjetPhases,
  regions: ["11"] as RegionCodes,
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ServicesWidget context={context} />
  </StrictMode>,
);
