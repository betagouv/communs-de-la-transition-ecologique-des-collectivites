import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";
import { ServicesWidget } from "../lib";

startReactDsfr({ defaultColorScheme: "system" });

const PROJECT_ID_WITHOUT_EXTRAFIELD = "test-tet-id";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ServicesWidget projectId={PROJECT_ID_WITHOUT_EXTRAFIELD} idType={"tetId"} debug />
  </StrictMode>,
);
