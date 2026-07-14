import { useMemo, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { LIBELLE_AXE, type Axe } from "../types";

/**
 * Choix d'étiquettes DANS LA TAXONOMIE FERMÉE, servie par l'API.
 *
 * On ne saisit pas de texte libre, et c'est tout l'intérêt : une étiquette mal orthographiée ferait
 * que le questionnaire n'est JAMAIS proposé, sans le moindre message. L'API le refuse (400) — mais
 * ici on rend la faute IMPOSSIBLE, ce qui vaut mieux que de la rattraper.
 *
 * La liste vient de `GET /admin/taxonomies`. Elle n'est jamais recopiée dans ce dépôt : une copie
 * dérive, et on réintroduirait la coquille du côté où personne ne la verrait.
 */
export function ChoixEtiquettes({
  axe,
  disponibles,
  choisies,
  onChange,
}: {
  axe: Axe;
  disponibles: string[];
  choisies: string[];
  onChange: (etiquettes: string[]) => void;
}) {
  const [recherche, setRecherche] = useState("");

  const suggestions = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 2) return [];
    return disponibles.filter((label) => !choisies.includes(label) && label.toLowerCase().includes(q)).slice(0, 8);
  }, [recherche, disponibles, choisies]);

  const ajouter = (label: string) => {
    onChange([...choisies, label]);
    setRecherche("");
  };

  return (
    <div className={fr.cx("fr-mb-3w")}>
      <p className={fr.cx("fr-text--sm", "fr-mb-1w")}>
        <strong>{LIBELLE_AXE[axe].pluriel}</strong>{" "}
        <span className={fr.cx("fr-text--xs")}>({disponibles.length} disponibles)</span>
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginBottom: "0.5rem" }}>
        {choisies.length === 0 && <span className={fr.cx("fr-text--xs")}>aucune</span>}
        {choisies.map((label) => (
          <button
            key={label}
            type="button"
            title="Retirer"
            onClick={() => onChange(choisies.filter((l) => l !== label))}
            style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
          >
            <Badge severity="success" noIcon small>
              {label} ✕
            </Badge>
          </button>
        ))}
      </div>

      <Input
        label=""
        nativeInputProps={{
          value: recherche,
          onChange: (e) => setRecherche(e.target.value),
          placeholder: `Chercher une ${LIBELLE_AXE[axe].singulier}…`,
        }}
      />

      {suggestions.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {suggestions.map((label) => (
            <li key={label}>
              <button
                type="button"
                className={fr.cx("fr-btn", "fr-btn--tertiary-no-outline", "fr-btn--sm")}
                onClick={() => ajouter(label)}
                style={{ width: "100%", justifyContent: "flex-start", textAlign: "left" }}
              >
                + {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
