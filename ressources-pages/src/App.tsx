import { Routes, Route } from "react-router-dom";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { headerFooterDisplayItem } from "@codegouvfr/react-dsfr/Display";
import { Home } from "./pages/Home";

function App() {
  return (
    <>
      <Header
        brandTop={
          <>
            RÉPUBLIQUE
            <br />
            FRANÇAISE
          </>
        }
        homeLinkProps={{
          href: "/ressources",
          title: "Accueil - API Collectivités",
        }}
        serviceTitle="API Collectivités"
        serviceTagline="Ressources pour la transition écologique"
        quickAccessItems={[
          {
            iconId: "fr-icon-arrow-left-line",
            linkProps: {
              href: "/api",
            },
            text: "Documentation API",
          },
          headerFooterDisplayItem,
        ]}
      />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </main>

      <Footer
        accessibility="partially compliant"
        brandTop={
          <>
            RÉPUBLIQUE
            <br />
            FRANÇAISE
          </>
        }
        homeLinkProps={{
          href: "/ressources",
          title: "Accueil - API Collectivités",
        }}
        bottomItems={[headerFooterDisplayItem]}
        license={
          <>
            Sauf mention contraire, tous les contenus de ce site sont sous{" "}
            <a
              href="https://github.com/etalab/licence-ouverte/blob/master/LO.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              licence etalab-2.0
            </a>
          </>
        }
      />
    </>
  );
}

export default App;
