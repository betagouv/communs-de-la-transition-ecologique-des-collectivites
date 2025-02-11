import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LesCommuns } from "../lib";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";

startReactDsfr({ defaultColorScheme: "system" });

// const PROJECT_ID_WITH_EXTRAFIELD = "0194efd7-0407-7e7a-8026-719908bee776";
const PROJECT_ID_WITHOUT_EXTRAFIELD = "0194f434-08f4-780b-b722-cd33353e8f1d";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LesCommuns projectId={PROJECT_ID_WITHOUT_EXTRAFIELD} />
  </StrictMode>
);
