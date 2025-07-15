import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";
import { ServicesWidget } from "../lib";
// import { CompetenceCode, Levier, ProjetPhase } from "../lib/shared-types.ts";
// import { CompetenceCode, Levier, ProjetPhase } from "@communs/shared";

startReactDsfr({ defaultColorScheme: "system" });

const PROJECT_ID_WITHOUT_EXTRAFIELD = "0197e4c8-ff96-7041-8dd5-3603b447f6c0";

// const context = {
//   competences: ["90-518" as CompetenceCode, "90-11" as CompetenceCode],
//   leviers: ["Gestion des haies" as Levier, "2 roues (élec&efficacité)" as Levier],
//   phases: ["Idée" as ProjetPhase, "Opération" as ProjetPhase],
// };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ServicesWidget projectId={PROJECT_ID_WITHOUT_EXTRAFIELD} debug />
  </StrictMode>,
);
