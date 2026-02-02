import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";
import App from "./App.tsx";

startReactDsfr({
  defaultColorScheme: "system",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/ressources">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
