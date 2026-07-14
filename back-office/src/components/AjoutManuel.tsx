import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import { ajouterAide, ajouterService, ajouterServiceLibre } from "../api";

/**
 * Ajouter à la main une aide ou un service, pour vérifier la boucle complète.
 *
 * L'écran n'a AUCUNE règle : il poste, et l'aperçu se recharge — c'est-à-dire qu'il réaffiche ce que
 * l'API renvoie. C'est le seul moyen de savoir si l'ajout est réellement pris en compte, plutôt que
 * de le croire.
 *
 * L'ASYMÉTRIE ENTRE AIDES ET SERVICES EST DÉLIBÉRÉE, et elle se voit ici.
 *
 * Un service peut être ajouté HORS CATALOGUE : le catalogue est LE NÔTRE, donc un service qui n'y
 * figure pas existe quand même (un outil local, un service partenaire pas encore benchmarké), et
 * personne d'autre que l'agent ne peut le décrire. Il est alors la source de vérité — il n'y a
 * aucune autorité extérieure à tenir en phase.
 *
 * Une aide, elle, n'existe que dans Aides-territoires, et doit être disponible sur le TERRITOIRE du
 * projet. Hors de là, aucune autorité ne la valide, et l'ajout serait impossible à résoudre à la
 * lecture — donc invisible. L'API le refuse (400), et c'est volontairement visible à l'écran :
 * sans le message, on ne saurait pas pourquoi l'ajout n'a pas pris.
 */
type Mode = "catalogue" | "libre";

export function AjoutManuel({
  projetId,
  plateforme,
  onAjout,
}: {
  projetId: string;
  plateforme: string;
  onAjout: () => void;
}) {
  const [aideId, setAideId] = useState("");
  const [mode, setMode] = useState<Mode>("catalogue");
  const [slug, setSlug] = useState("");
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [operateur, setOperateur] = useState("");
  const [message, setMessage] = useState("");

  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const poster = async (action: () => Promise<unknown>, quoi: string) => {
    setEnvoi(true);
    setErreur(null);
    setSucces(null);
    try {
      await action();
      setSucces(`${quoi} ajouté au nom de ${plateforme}. L'aperçu ci-dessous est rechargé.`);
      setAideId("");
      setSlug("");
      setNom("");
      setDescription("");
      setUrl("");
      setOperateur("");
      setMessage("");
      onAjout();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setEnvoi(false);
    }
  };

  const libreComplet = nom.trim() !== "" && description.trim() !== "";

  return (
    <div className={fr.cx("fr-callout", "fr-mb-3w")}>
      <h3 className={fr.cx("fr-callout__title", "fr-h6")}>Ajouter à la main, au nom de {plateforme}</h3>
      <p className={fr.cx("fr-text--sm")}>
        Pour vérifier que l&apos;ajout est réellement pris en compte : l&apos;aperçu se recharge, et affiche ce que
        l&apos;API renvoie.
      </p>

      {erreur && (
        <div className={fr.cx("fr-alert", "fr-alert--error", "fr-alert--sm", "fr-mb-2w")}>
          <p>{erreur}</p>
        </div>
      )}
      {succes && (
        <div className={fr.cx("fr-alert", "fr-alert--success", "fr-alert--sm", "fr-mb-2w")}>
          <p>{succes}</p>
        </div>
      )}

      <Input
        label="Message (facultatif)"
        hintText="« Recommandé par la DDT lors du COPIL du 12/03 ». Rendu tel quel à côté de l'aide ou du service."
        nativeInputProps={{ value: message, onChange: (e) => setMessage(e.target.value) }}
      />

      <fieldset className={fr.cx("fr-fieldset", "fr-mt-2w")}>
        <legend className={fr.cx("fr-fieldset__legend", "fr-text--bold")}>Une aide</legend>

        <div style={{ maxWidth: "20rem" }}>
          <Input
            label="Identifiant Aides-territoires"
            hintText="Elle doit être disponible sur le territoire du projet — sinon l'API refuse (400)."
            nativeInputProps={{
              type: "number",
              value: aideId,
              placeholder: "165809",
              onChange: (e) => setAideId(e.target.value),
            }}
          />
        </div>
        <p className={fr.cx("fr-text--xs")}>
          Pas d&apos;aide « hors catalogue » : une aide n&apos;existe que dans Aides-territoires. Hors de là, rien ne la
          valide, et l&apos;ajout serait impossible à résoudre à la lecture.
        </p>
        <Button
          size="small"
          disabled={envoi || !aideId.trim()}
          onClick={() => void poster(() => ajouterAide(projetId, plateforme, Number(aideId), message), "Aide")}
        >
          Ajouter l&apos;aide
        </Button>
      </fieldset>

      <fieldset className={fr.cx("fr-fieldset", "fr-mt-2w")}>
        <legend className={fr.cx("fr-fieldset__legend", "fr-text--bold")}>Un service numérique</legend>

        <RadioButtons
          orientation="horizontal"
          options={[
            {
              label: "Du catalogue",
              nativeInputProps: { checked: mode === "catalogue", onChange: () => setMode("catalogue") },
            },
            {
              label: "Hors catalogue — je le décris",
              nativeInputProps: { checked: mode === "libre", onChange: () => setMode("libre") },
            },
          ]}
        />

        {mode === "catalogue" ? (
          <>
            <div style={{ maxWidth: "24rem" }}>
              <Input
                label="Slug"
                hintText="Doit exister au catalogue — sinon l'API refuse (404). Sa fiche reste la source : on ne recopie rien."
                nativeInputProps={{
                  value: slug,
                  placeholder: "benefriches",
                  onChange: (e) => setSlug(e.target.value),
                }}
              />
            </div>
            <Button
              size="small"
              disabled={envoi || !slug.trim()}
              onClick={() => void poster(() => ajouterService(projetId, plateforme, slug.trim(), message), "Service")}
            >
              Ajouter le service
            </Button>
          </>
        ) : (
          <>
            <p className={fr.cx("fr-text--xs")}>
              Un outil local, un service partenaire pas encore benchmarké : il existe, et vous êtes le seul à pouvoir le
              décrire. Ses informations sont figées — c&apos;est vous la source. Sa classification reste inconnue :
              l&apos;API n&apos;en invente aucune.
            </p>

            <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
              <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
                <Input
                  label="Nom"
                  nativeInputProps={{
                    value: nom,
                    placeholder: "Cadastre solaire de la métropole",
                    onChange: (e) => setNom(e.target.value),
                  }}
                />
              </div>
              <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
                <Input
                  label="Opérateur (facultatif)"
                  nativeInputProps={{
                    value: operateur,
                    placeholder: "Métropole",
                    onChange: (e) => setOperateur(e.target.value),
                  }}
                />
              </div>
              <div className={fr.cx("fr-col-12")}>
                <Input
                  label="Description"
                  nativeInputProps={{
                    value: description,
                    placeholder: "Estime le potentiel photovoltaïque de chaque toiture du territoire.",
                    onChange: (e) => setDescription(e.target.value),
                  }}
                />
              </div>
              <div className={fr.cx("fr-col-12")}>
                <Input
                  label="Lien (facultatif)"
                  nativeInputProps={{
                    value: url,
                    placeholder: "https://cadastre-solaire.exemple.fr",
                    onChange: (e) => setUrl(e.target.value),
                  }}
                />
              </div>
            </div>

            <Button
              size="small"
              disabled={envoi || !libreComplet}
              onClick={() =>
                void poster(
                  () =>
                    ajouterServiceLibre(
                      projetId,
                      plateforme,
                      {
                        nom: nom.trim(),
                        description: description.trim(),
                        url: url.trim() || undefined,
                        operateur: operateur.trim() || undefined,
                      },
                      message,
                    ),
                  "Service hors catalogue",
                )
              }
            >
              Ajouter ce service
            </Button>
          </>
        )}
      </fieldset>
    </div>
  );
}
