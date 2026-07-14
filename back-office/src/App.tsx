import { useCallback, useEffect, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { CleRefusee, getContenu, lireCle, oublierCle, simuler } from "./api";
import { PorteCle } from "./components/PorteCle";
import { Catalogue } from "./components/Catalogue";
import { Questionnaires } from "./components/Questionnaires";
import { Services } from "./components/Services";
import { compterEtiquettes, type Contenu, type Simulation } from "./types";

/**
 * Back-office — LECTURE et SIMULATION uniquement. Il n'écrit rien.
 *
 * On simule sur un projet RÉEL, désigné par son id : un projet fabriqué à la main dirait ce
 * qu'on veut entendre. C'est exactement ce piège qui a produit un faux diagnostic sur le seuil
 * des services — une classification inventée, trop pauvre, donnait des scores flatteurs.
 */
export default function App() {
  const [authentifie, setAuthentifie] = useState(lireCle() !== null);
  const [refusee, setRefusee] = useState(false);

  const [contenu, setContenu] = useState<Contenu | null>(null);
  const [projetId, setProjetId] = useState("");
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  /** Une clé refusée n'est pas une erreur à afficher : c'est une clé à redemander. */
  const gererErreur = useCallback((e: unknown) => {
    if (e instanceof CleRefusee) {
      setAuthentifie(false);
      setRefusee(true);
      return;
    }
    setErreur(e instanceof Error ? e.message : "Erreur inattendue.");
  }, []);

  useEffect(() => {
    if (!authentifie) return;
    getContenu().then(setContenu).catch(gererErreur);
  }, [authentifie, gererErreur]);

  const lancer = (e: React.FormEvent) => {
    e.preventDefault();
    void executer();
  };

  const executer = async () => {
    if (!projetId.trim()) return;

    setChargement(true);
    setErreur(null);
    setSimulation(null);
    try {
      setSimulation(await simuler(projetId.trim()));
    } catch (e) {
      gererErreur(e);
    } finally {
      setChargement(false);
    }
  };

  if (!authentifie) {
    return (
      <PorteCle
        refusee={refusee}
        onCle={() => {
          setRefusee(false);
          setAuthentifie(true);
        }}
      />
    );
  }

  const projet = simulation?.projet;

  return (
    <>
      <Header
        brandTop={
          <>
            République
            <br />
            Française
          </>
        }
        homeLinkProps={{ href: "/", title: "Accueil - Les Communs" }}
        serviceTitle="Les Communs de la transition écologique"
        serviceTagline="Back-office — lecture et simulation"
        quickAccessItems={[
          {
            buttonProps: {
              onClick: () => {
                oublierCle();
                setAuthentifie(false);
              },
            },
            iconId: "fr-icon-logout-box-r-line",
            text: "Oublier la clé",
          },
        ]}
      />

      <div className={fr.cx("fr-container", "fr-py-4w")}>
        <Tabs
          tabs={[
            {
              label: "Simulation",
              content: (
                <>
                  <form onSubmit={lancer}>
                    <Input
                      label="Identifiant d'un projet réel"
                      hintText="On simule sur une vraie classification, avec ses trous. Rien n'est enregistré."
                      nativeInputProps={{
                        value: projetId,
                        onChange: (e) => setProjetId(e.target.value),
                        placeholder: "019f5c56-5873-72ce-94cd-b7b00e5c619c",
                      }}
                    />
                    <Button type="submit" disabled={chargement || !projetId.trim()}>
                      {chargement ? "Simulation…" : "Simuler"}
                    </Button>
                  </form>

                  {erreur && (
                    <div className={fr.cx("fr-alert", "fr-alert--error", "fr-mt-3w")}>
                      <p>{erreur}</p>
                    </div>
                  )}

                  {projet && simulation && (
                    <>
                      <div className={fr.cx("fr-callout", "fr-mt-4w")}>
                        <h2 className={fr.cx("fr-callout__title", "fr-h5")}>{projet.nom}</h2>
                        <p className={fr.cx("fr-callout__text", "fr-text--sm")}>
                          phase : {projet.phase ?? "non renseignée"} — {compterEtiquettes(projet.classificationScores)}{" "}
                          étiquettes de classification
                        </p>
                      </div>

                      {projet.avertissement && (
                        <div className={fr.cx("fr-alert", "fr-alert--warning", "fr-mt-2w")}>
                          <p>{projet.avertissement}</p>
                        </div>
                      )}

                      <Questionnaires
                        questionnaires={simulation.questionnaires}
                        seuil={simulation.seuils.eligibilite}
                      />
                      <Services services={simulation.services} seuilApi={simulation.seuils.pertinence} />
                    </>
                  )}
                </>
              ),
            },
            {
              label: "Catalogue",
              content: contenu ? <Catalogue contenu={contenu} /> : <p>Chargement…</p>,
            },
          ]}
        />
      </div>
    </>
  );
}
