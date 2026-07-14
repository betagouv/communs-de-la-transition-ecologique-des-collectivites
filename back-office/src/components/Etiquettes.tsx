import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import type { EtiquettesCommunes } from "../types";

/**
 * Les étiquettes réellement partagées entre le projet et le candidat.
 *
 * Un score de 0,19 tout seul est un chiffre opaque : on ne sait ni pourquoi il est bas, ni quoi
 * corriger. Affiché avec ce qui l'a produit, il devient actionnable — c'est ce qui a permis de
 * voir que la classification des services est trop maigre, pas que le seuil est mal réglé.
 */
export function Etiquettes({ communes }: { communes: EtiquettesCommunes }) {
  const total = communes.thematiques.length + communes.sites.length + communes.interventions.length;

  if (total === 0) {
    return (
      <span className={fr.cx("fr-text--xs")} style={{ color: "var(--text-mention-grey)" }}>
        aucun recouvrement
      </span>
    );
  }

  // L'axe compte : les thématiques pèsent 0,45 du score, les lieux 0,35, les modalités 0,20.
  // Un recouvrement uniquement sur les modalités ne vaut pas un recouvrement thématique.
  const parAxe = [
    { etiquettes: communes.thematiques, severite: "success" as const, titre: "thématique (poids 0,45)" },
    { etiquettes: communes.sites, severite: "info" as const, titre: "lieu (poids 0,35)" },
    { etiquettes: communes.interventions, severite: "new" as const, titre: "modalité (poids 0,20)" },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
      {parAxe.flatMap(({ etiquettes, severite, titre }) =>
        etiquettes.map((label) => (
          <span key={`${titre}-${label}`} title={titre}>
            <Badge severity={severite} noIcon small>
              {label}
            </Badge>
          </span>
        )),
      )}
    </div>
  );
}
