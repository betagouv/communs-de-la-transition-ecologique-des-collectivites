import { useMemo, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { ToggleSwitch } from "@codegouvfr/react-dsfr/ToggleSwitch";
import { Etiquettes } from "./Etiquettes";
import { retenuAuSeuil, type ServiceSimule } from "../types";

const pourcent = (n: number) => `${(n * 100).toFixed(0)} %`;

/**
 * Le catalogue de services confronté à un projet, avec un curseur de seuil.
 *
 * POURQUOI UN CURSEUR. L'API renvoie TOUS les candidats avec leur score, pas seulement les
 * retenus : rejouer la sélection à un autre seuil est donc de l'arithmétique locale, sans rappel
 * réseau. On voit l'effet d'un réglage avant de le figer dans le code — c'est la seule façon
 * honnête de choisir un seuil, plutôt que de le deviner puis de le constater en production.
 *
 * Le score seul décide : il n'y a pas de repêchage. Une liste vide est une réponse légitime.
 */
export function Services({ services, seuilApi }: { services: ServiceSimule[]; seuilApi: number }) {
  const [seuil, setSeuil] = useState(seuilApi);
  const [masquerEcartes, setMasquerEcartes] = useState(true);

  const { comptes, visibles } = useMemo(() => {
    const avecVerdict = services.map((s) => ({ ...s, affiche: retenuAuSeuil(s, seuil) }));

    return {
      comptes: {
        affiches: avecVerdict.filter((s) => s.affiche).length,
        // Le vrai diagnostic : un service qui ne partage AUCUNE étiquette avec le projet ne peut
        // pas remonter, quel que soit le seuil. Baisser le curseur ne joue que sur les autres.
        sansRecouvrement: avecVerdict.filter((s) => s.score === 0).length,
      },
      visibles: masquerEcartes ? avecVerdict.filter((s) => s.affiche) : avecVerdict,
    };
  }, [services, seuil, masquerEcartes]);

  const deplace = Math.abs(seuil - seuilApi) > 0.001;

  return (
    <section className={fr.cx("fr-mt-6w")}>
      <h2 className={fr.cx("fr-h4")}>Services numériques</h2>

      <div className={fr.cx("fr-callout", "fr-mb-3w")}>
        <label className={fr.cx("fr-label")} htmlFor="seuil">
          Seuil de pertinence : <strong>{seuil.toFixed(2)}</strong>{" "}
          {deplace ? (
            <span className={fr.cx("fr-text--sm")}>
              — simulé (l&apos;API applique {seuilApi.toFixed(2)}){" "}
              <button className={fr.cx("fr-link", "fr-link--sm")} onClick={() => setSeuil(seuilApi)}>
                revenir
              </button>
            </span>
          ) : (
            <span className={fr.cx("fr-text--sm")}>— celui de l&apos;API</span>
          )}
        </label>
        <input
          id="seuil"
          type="range"
          min={0}
          max={0.6}
          step={0.01}
          value={seuil}
          onChange={(e) => setSeuil(Number(e.target.value))}
          style={{ width: "100%", maxWidth: "32rem" }}
        />

        <p className={fr.cx("fr-mt-2w", "fr-mb-0")}>
          <Badge severity={comptes.affiches > 0 ? "success" : "warning"} noIcon>
            {comptes.affiches} affiché{comptes.affiches > 1 ? "s" : ""} sur {services.length}
          </Badge>
        </p>

        <p className={fr.cx("fr-text--sm", "fr-mt-2w", "fr-mb-0")}>
          {comptes.sansRecouvrement} des {services.length} services ne partagent <strong>aucune</strong> étiquette avec
          ce projet : aucun seuil ne les fera remonter. Le curseur ne joue que sur les{" "}
          {services.length - comptes.sansRecouvrement} autres.
        </p>

        {comptes.affiches === 0 && (
          <p className={fr.cx("fr-text--sm", "fr-mt-2w", "fr-mb-0")}>
            Une liste vide est une réponse légitime : elle dit que le catalogue n&apos;a rien pour ce projet, ce qui est
            une information. C&apos;est plus utile qu&apos;une liste de remplissage.
          </p>
        )}
      </div>

      <ToggleSwitch
        label="Masquer les services écartés"
        checked={masquerEcartes}
        onChange={setMasquerEcartes}
        inputTitle="masquer-ecartes"
        showCheckedHint={false}
      />

      <div className={fr.cx("fr-table", "fr-table--sm", "fr-mt-2w")}>
        <table>
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col">Score</th>
              <th scope="col" title="Le score brut est modulé par l'adéquation à la phase du projet">
                dont phase
              </th>
              <th scope="col">Statut</th>
              <th scope="col">Étiquettes partagées avec le projet</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((s) => (
              <tr key={s.slug}>
                <td>{s.nom}</td>
                <td>
                  <strong>{s.score.toFixed(2)}</strong>
                </td>
                <td className={fr.cx("fr-text--xs")}>{s.facteurPhase < 1 ? `× ${pourcent(s.facteurPhase)}` : "—"}</td>
                <td>
                  <Badge severity={s.affiche ? "success" : "warning"} noIcon small>
                    {s.affiche ? "affiché" : "écarté"}
                  </Badge>
                </td>
                <td>
                  <Etiquettes communes={s.etiquettesCommunes} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibles.length === 0 && <p className={fr.cx("fr-text--sm")}>Aucun service remonté à ce seuil.</p>}
    </section>
  );
}
