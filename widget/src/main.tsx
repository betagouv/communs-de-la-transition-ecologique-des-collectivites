import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LesCommuns } from "./LesCommuns";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";

startReactDsfr({ defaultColorScheme: "system" });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LesCommuns projectId="test-id" />
  </StrictMode>,
);
