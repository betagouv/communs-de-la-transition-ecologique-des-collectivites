import { useCallback, useEffect, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { CleRefusee, getContenu, getTaxonomies, lireCle, oublierCle, simuler } from "./api";
import { PorteCle } from "./components/PorteCle";
import { Catalogue } from "./components/Catalogue";
import { QuestionnairesSimules } from "./components/QuestionnairesSimules";
import { CatalogueQuestionnaires } from "./components/CatalogueQuestionnaires";
import { Services } from "./components/Services";
import { Apercu } from "./components/Apercu";
import { compterEtiquettes, type Contenu, type Simulation, type Taxonomies } from "./types";

/**
 * Back-office : simuler ce que verra une collectivité, et ÉDITER les questionnaires.
 *
 * La simulation n'écrit rien — les réponses qu'on y saisit ne sont jamais enregistrées. L'édition,
 * elle, écrit : elle passe par l'API, qui valide tout (étiquettes dans la taxonomie fermée,
 * conditions résolubles, ids uniques) et refuse en 400 explicite. Aucune règle n'est rejouée ici :
 * la dupliquer donnerait deux vérités à tenir en phase, et celle du client serait contournable.
 *
 * On simule sur un projet RÉEL, désigné par son id : un projet fabriqué à la main dirait ce
 * qu'on veut entendre. C'est exactement ce piège qui a produit un faux diagnostic sur le seuil
 * des services — une classification inventée, trop pauvre, donnait des scores flatteurs.
 */
export default function App() {
  const [authentifie, setAuthentifie] = useState(lireCle() !== null);
  const [refusee, setRefusee] = useState(false);

  const [contenu, setContenu] = useState<Contenu | null>(null);
  const [taxonomies, setTaxonomies] = useState<Taxonomies | null>(null);
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

  const recharger = useCallback(() => {
    getContenu().then(setContenu).catch(gererErreur);
  }, [gererErreur]);

  useEffect(() => {
    if (!authentifie) return;
    recharger();
    // Les taxonomies fermées ne changent pas : un seul chargement suffit. Elles ne sont JAMAIS
    // recopiées dans ce dépôt — une copie dérive, et on réintroduirait la coquille que la
    // validation de l'API vient d'éliminer, du côté où personne ne la verrait.
    getTaxonomies().then(setTaxonomies).catch(gererErreur);
  }, [authentifie, gererErreur, recharger]);

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
      {/* SUR QUELLE API SUIS-JE ? Rien ne le disait, et c'est un vrai piège : le back-office tourne
          en local mais peut viser n'importe quelle API (locale, staging), figée au lancement par
          VITE_API_TARGET. On perd un temps fou à croire qu'une clé est mauvaise alors qu'on parle à
          la mauvaise machine. */}
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
        serviceTagline={`Back-office — ${cible()}`}
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

                      {/* CE QUE L'API RENVOIE RÉELLEMENT — les réponses exactes des endpoints
                          publics, produites par les mêmes fonctions qui servent MEC. */}
                      <Apercu projetId={projet.id} />

                      {/* DIAGNOSTIC — pourquoi les autres candidats sont écartés. L'aperçu ne
                          montre que les retenus : il ne dit pas ce qui manque aux autres. */}
                      <QuestionnairesSimules questionnaires={simulation.questionnaires} />
                      <Services services={simulation.services} seuilApi={simulation.seuils.pertinence} />
                    </>
                  )}
                </>
              ),
            },
            {
              label: "Questionnaires",
              content:
                contenu && taxonomies ? (
                  <CatalogueQuestionnaires
                    questionnaires={contenu.questionnaires}
                    taxonomies={taxonomies}
                    onChangement={recharger}
                  />
                ) : (
                  <p>Chargement…</p>
                ),
            },
            {
              label: "Services",
              content: contenu ? <Catalogue contenu={contenu} /> : <p>Chargement…</p>,
            },
          ]}
        />
      </div>
    </>
  );
}

/**
 * L'API que ce back-office interroge, telle qu'elle a été fixée au lancement.
 *
 * `VITE_API_TARGET` est lue au démarrage du serveur de dev et ne peut pas changer ensuite : la
 * changer impose de relancer `pnpm dev`. L'afficher évite l'erreur qui coûte le plus cher — croire
 * que sa clé est refusée alors qu'on parle à la mauvaise API.
 */
function cible(): string {
  const url = (import.meta.env.VITE_API_TARGET as string | undefined) ?? "http://localhost:3000";
  if (url.includes("staging")) return "STAGING";
  if (url.includes("prod")) return "⚠ PRODUCTION";
  return `local (${url})`;
}
