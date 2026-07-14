import { useMemo, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Input } from "@codegouvfr/react-dsfr/Input";
import type { Contenu } from "../types";

/**
 * Le catalogue, trié par PAUVRETÉ de classification.
 *
 * Ce tri n'est pas cosmétique. Un service sans thématique ne peut matcher aucun projet : il est
 * invisible sauf repêchage générique. Trier par richesse croissante met donc en tête exactement
 * ce qu'il faut réparer — et rend visible d'un coup d'œil si le problème est le seuil ou la
 * donnée. Trié par ordre alphabétique, ce même tableau ne dirait rien.
 */
export function Catalogue({ contenu }: { contenu: Contenu }) {
  const [filtre, setFiltre] = useState("");

  const services = useMemo(() => {
    const requete = filtre.trim().toLowerCase();

    return contenu.services
      .map((s) => ({
        ...s,
        nbThematiques: s.classification.thematiques.length,
        nbTotal:
          s.classification.thematiques.length + s.classification.sites.length + s.classification.interventions.length,
      }))
      .filter((s) => !requete || s.nom.toLowerCase().includes(requete))
      .sort((a, b) => a.nbThematiques - b.nbThematiques || a.nbTotal - b.nbTotal || a.nom.localeCompare(b.nom));
  }, [contenu.services, filtre]);

  const sansThematique = contenu.services.filter((s) => s.classification.thematiques.length === 0).length;

  return (
    <section className={fr.cx("fr-mt-4w")}>
      <div className={fr.cx("fr-callout", "fr-mb-3w")}>
        <p className={fr.cx("fr-mb-0")}>
          <strong>{contenu.services.length}</strong> services, dont <strong>{sansThematique}</strong> sans aucune
          thématique. Ces derniers ne remonteront <strong>jamais</strong>, sur aucun projet : sans thématique, leur
          score est nul par construction, et il n&apos;y a pas de repêchage. C&apos;est un défaut de données à corriger
          dans le benchmark — la liste ci-dessous les met en tête.
        </p>
      </div>

      <Input
        label="Filtrer"
        nativeInputProps={{ value: filtre, onChange: (e) => setFiltre(e.target.value), placeholder: "nom du service" }}
      />

      <div className={fr.cx("fr-table", "fr-table--sm")}>
        <table>
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col" title="Poids 0,45 dans le score : l'axe qui décide">
                Thématiques
              </th>
              <th scope="col">Lieux</th>
              <th scope="col">Modalités</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.slug}>
                <td>
                  {s.nom}
                  {s.nbTotal === 0 && (
                    <>
                      {" "}
                      <Badge severity="error" noIcon small>
                        non classifié
                      </Badge>
                    </>
                  )}
                </td>
                <td className={fr.cx("fr-text--xs")}>
                  {s.nbThematiques === 0 ? (
                    <Badge severity="warning" noIcon small>
                      aucune
                    </Badge>
                  ) : (
                    s.classification.thematiques.map((t) => t.label).join(", ")
                  )}
                </td>
                <td className={fr.cx("fr-text--xs")}>{s.classification.sites.map((t) => t.label).join(", ") || "—"}</td>
                <td className={fr.cx("fr-text--xs")}>
                  {s.classification.interventions.map((t) => t.label).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
