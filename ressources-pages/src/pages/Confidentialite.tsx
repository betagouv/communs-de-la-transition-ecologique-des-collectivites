import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { ToggleSwitch } from "@codegouvfr/react-dsfr/ToggleSwitch";
import { Alert } from "@codegouvfr/react-dsfr/Alert";

const MATOMO_OPT_OUT_KEY = "matomo-opt-out";

export function Confidentialite() {
  // Read initial value synchronously to avoid flash
  const getStoredOptOut = () => localStorage.getItem(MATOMO_OPT_OUT_KEY) === "true";
  const [isOptedOut, setIsOptedOut] = useState(getStoredOptOut);

  const handleOptOutChange = (checked: boolean) => {
    const optOut = !checked; // Toggle shows "tracking enabled", so invert
    setIsOptedOut(optOut);
    localStorage.setItem(MATOMO_OPT_OUT_KEY, String(optOut));

    // Update Matomo tracking status
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
    const _paq = (window as any)._paq;
    if (typeof window !== "undefined" && _paq) {
      if (optOut) {
        _paq.push(["optUserOut"]);
      } else {
        _paq.push(["forgetUserOptOut"]);
      }
    }
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
  };

  return (
    <div className={fr.cx("fr-container", "fr-py-8w")}>
      <h1>Politique de confidentialité</h1>

      <section className={fr.cx("fr-mt-4w")}>
        <h2>Collecte de données de navigation</h2>
        <p>
          Ce site utilise <strong>Matomo</strong>, un outil de mesure d&apos;audience respectueux de la vie privée,
          hébergé par beta.gouv.fr sur l&apos;instance <code>stats.beta.gouv.fr</code>.
        </p>

        <h3>Données collectées</h3>
        <p>Les données suivantes sont collectées de manière anonyme :</p>
        <ul>
          <li>Pages visitées et durée de visite</li>
          <li>Origine de la visite (site référent)</li>
          <li>Type d&apos;appareil, navigateur et système d&apos;exploitation</li>
          <li>Localisation géographique approximative (pays/région)</li>
        </ul>

        <h3>Ce que nous ne faisons pas</h3>
        <ul>
          <li>
            <strong>Aucun cookie</strong> n&apos;est déposé sur votre navigateur
          </li>
          <li>
            <strong>Aucun identifiant personnel</strong> n&apos;est collecté
          </li>
          <li>
            Votre adresse IP est <strong>anonymisée</strong> (les 2 derniers octets sont masqués)
          </li>
          <li>
            <strong>Aucun suivi inter-sites</strong> n&apos;est effectué
          </li>
          <li>Les données ne sont pas revendues ni partagées avec des tiers</li>
        </ul>

        <Alert
          severity="info"
          title="Conformité CNIL"
          description="Cette configuration est conforme aux recommandations de la CNIL et ne nécessite pas de bandeau de consentement aux cookies."
          className={fr.cx("fr-mt-4w")}
        />
      </section>

      <section className={fr.cx("fr-mt-6w")}>
        <h2>Vos choix concernant le suivi</h2>
        <p>
          Bien que notre configuration respecte votre vie privée, vous pouvez choisir de désactiver complètement le
          suivi statistique. Ce choix sera mémorisé dans votre navigateur.
        </p>

        <div className={fr.cx("fr-mt-4w", "fr-p-4w")} style={{ backgroundColor: "var(--background-alt-grey)" }}>
          <ToggleSwitch
            label="Autoriser la mesure d'audience anonyme"
            helperText={
              isOptedOut
                ? "Le suivi statistique est actuellement désactivé"
                : "Le suivi statistique est actuellement activé"
            }
            checked={!isOptedOut}
            onChange={handleOptOutChange}
          />
        </div>

        {isOptedOut && (
          <Alert
            severity="success"
            title="Suivi désactivé"
            description="Vos visites ne sont plus comptabilisées dans nos statistiques."
            className={fr.cx("fr-mt-4w")}
          />
        )}
      </section>

      <section className={fr.cx("fr-mt-6w")}>
        <h2>Finalité des données</h2>
        <p>Les données collectées sont utilisées exclusivement pour :</p>
        <ul>
          <li>Mesurer la fréquentation du site</li>
          <li>Comprendre les parcours utilisateurs pour améliorer l&apos;ergonomie</li>
          <li>Identifier les contenus les plus consultés</li>
          <li>Détecter d&apos;éventuels problèmes techniques</li>
        </ul>
        <p>
          Ces données sont conservées pendant <strong>25 mois</strong> maximum, conformément aux recommandations de la
          CNIL.
        </p>
      </section>

      <section className={fr.cx("fr-mt-6w")}>
        <h2>Vos droits</h2>
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul>
          <li>Droit d&apos;accès à vos données</li>
          <li>Droit de rectification</li>
          <li>Droit à l&apos;effacement</li>
          <li>Droit à la limitation du traitement</li>
          <li>Droit à la portabilité</li>
          <li>Droit d&apos;opposition</li>
        </ul>
        <p>
          Pour exercer ces droits ou pour toute question, contactez-nous à :{" "}
          <a href="mailto:collectivites@beta.gouv.fr">collectivites@beta.gouv.fr</a>
        </p>
      </section>

      <section className={fr.cx("fr-mt-6w")}>
        <h2>Responsable du traitement</h2>
        <p>
          Le responsable du traitement est la <strong>Direction interministérielle du numérique (DINUM)</strong>, dans
          le cadre du programme beta.gouv.fr.
        </p>
        <address className={fr.cx("fr-mt-2w")}>
          DINUM
          <br />
          20 avenue de Ségur
          <br />
          75007 Paris
        </address>
      </section>
    </div>
  );
}
