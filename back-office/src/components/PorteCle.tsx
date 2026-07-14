import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { ecrireCle } from "../api";

/**
 * La clé est demandée à l'ouverture, jamais stockée dans un fichier.
 *
 * On ne la met ni dans un `.env` (qui finit versionné par accident) ni dans le bundle (qui part
 * sur un CDN) : c'est la clé d'administration, la même qui pilote la classification par lots.
 * Elle vit en sessionStorage et disparaît avec l'onglet.
 */
export function PorteCle({ onCle, refusee }: { onCle: () => void; refusee: boolean }) {
  const [valeur, setValeur] = useState("");

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valeur.trim()) return;
    ecrireCle(valeur.trim());
    onCle();
  };

  return (
    <form onSubmit={valider} className={fr.cx("fr-container", "fr-py-8w")} style={{ maxWidth: "36rem" }}>
      <h1 className={fr.cx("fr-h3")}>Back-office</h1>
      <p className={fr.cx("fr-text--sm", "fr-mb-3w")}>
        Outil interne de lecture et de simulation. Il n&apos;écrit rien : les réponses qu&apos;on y saisit ne sont
        jamais enregistrées.
      </p>

      {refusee && (
        <div className={fr.cx("fr-alert", "fr-alert--error", "fr-mb-3w")}>
          <p>Clé refusée par l&apos;API.</p>
        </div>
      )}

      <Input
        label="Clé d'administration"
        hintText="SERVICE_MANAGEMENT_API_KEY — gardée le temps de l'onglet, jamais écrite sur disque."
        nativeInputProps={{
          type: "password",
          value: valeur,
          onChange: (e) => setValeur(e.target.value),
          autoFocus: true,
        }}
      />
      <Button type="submit" disabled={!valeur.trim()}>
        Entrer
      </Button>
    </form>
  );
}
