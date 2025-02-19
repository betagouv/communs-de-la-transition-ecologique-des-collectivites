import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";
import { ServicesWidget } from "../lib";

startReactDsfr({ defaultColorScheme: "system" });

const PROJECT_ID_WITHOUT_EXTRAFIELD = "01950465-1384-7332-88ff-b535cb868ed8";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ServicesWidget projectId={PROJECT_ID_WITHOUT_EXTRAFIELD} />
  </StrictMode>,
);
