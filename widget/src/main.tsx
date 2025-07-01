import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";
import { ServicesWidget } from "../lib";

startReactDsfr({ defaultColorScheme: "system" });

const PROJECT_ID_WITHOUT_EXTRAFIELD = "0197c695-61dd-7d50-95ca-644c9e8c6c8e";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ServicesWidget projectId={PROJECT_ID_WITHOUT_EXTRAFIELD} debug />
  </StrictMode>,
);
