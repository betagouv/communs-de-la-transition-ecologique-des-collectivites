import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { ajouterAide, ajouterService } from "../api";

/**
 * Ajouter à la main une aide ou un service, pour vérifier la boucle complète.
 *
 * L'écran n'a AUCUNE règle : il poste, et il réaffiche l'aperçu — c'est-à-dire ce que l'API renvoie
 * réellement. C'est le seul moyen de savoir si l'ajout est réellement pris en compte, plutôt que de
 * le croire.
 *
 * Les gardes de l'API restent entières, et c'est volontairement visible : une aide hors du
 * territoire du projet est refusée (400), un slug inconnu du catalogue aussi (404). Le message
 * s'affiche tel quel — sans lui, on ne saurait pas POURQUOI l'ajout n'a pas pris.
 */
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
  const [slug, setSlug] = useState("");
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
      setMessage("");
      onAjout();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setEnvoi(false);
    }
  };

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
        hintText="« Recommandée par la DDT lors du COPIL du 12/03 ». Rendu tel quel à côté de l'aide ou du service."
        nativeInputProps={{ value: message, onChange: (e) => setMessage(e.target.value) }}
      />

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
          <Input
            label="Identifiant d'aide (Aides-territoires)"
            hintText="Elle doit être disponible sur le territoire du projet, sinon l'API refuse (400)."
            nativeInputProps={{
              type: "number",
              value: aideId,
              placeholder: "165809",
              onChange: (e) => setAideId(e.target.value),
            }}
          />
          <Button
            size="small"
            disabled={envoi || !aideId.trim()}
            onClick={() => void poster(() => ajouterAide(projetId, plateforme, Number(aideId), message), "Aide")}
          >
            Ajouter l&apos;aide
          </Button>
        </div>

        <div className={fr.cx("fr-col-12", "fr-col-md-6")}>
          <Input
            label="Slug de service (catalogue)"
            hintText="Doit exister au catalogue, sinon l'API refuse (404)."
            nativeInputProps={{ value: slug, placeholder: "benefriches", onChange: (e) => setSlug(e.target.value) }}
          />
          <Button
            size="small"
            disabled={envoi || !slug.trim()}
            onClick={() => void poster(() => ajouterService(projetId, plateforme, slug.trim(), message), "Service")}
          >
            Ajouter le service
          </Button>
        </div>
      </div>
    </div>
  );
}
