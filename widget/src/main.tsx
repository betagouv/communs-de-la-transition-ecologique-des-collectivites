import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";
import { ServicesWidget } from "../lib";

startReactDsfr({ defaultColorScheme: "system" });

const PROJECT_ID_WITHOUT_EXTRAFIELD = "01968848-84d8-7ccb-a0fa-accaff842095";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ServicesWidget projectId={PROJECT_ID_WITHOUT_EXTRAFIELD} debug />
  </StrictMode>,
);
