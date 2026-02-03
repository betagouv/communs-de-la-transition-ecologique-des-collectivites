import { Routes, Route } from "react-router-dom";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { headerFooterDisplayItem } from "@codegouvfr/react-dsfr/Display";
import { Home } from "./pages/Home";
import { Vocabulaire } from "./pages/Vocabulaire";
import { Confidentialite } from "./pages/Confidentialite";

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
        quickAccessItems={[headerFooterDisplayItem]}
      />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vocabulaire" element={<Vocabulaire />} />
          <Route path="/confidentialite" element={<Confidentialite />} />
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
        bottomItems={[
          {
            text: "Données personnelles et cookies",
            linkProps: {
              href: "/ressources/confidentialite",
            },
          },
          headerFooterDisplayItem,
        ]}
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
