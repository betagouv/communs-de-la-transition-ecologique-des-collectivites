import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";
import { ServicesWidget } from "../lib";

startReactDsfr({ defaultColorScheme: "system" });

const PROJECT_ID_WITHOUT_EXTRAFIELD = "01973222-5e47-7cfd-a5b7-4e427f423e74";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ServicesWidget projectId={PROJECT_ID_WITHOUT_EXTRAFIELD} debug />
  </StrictMode>,
);
