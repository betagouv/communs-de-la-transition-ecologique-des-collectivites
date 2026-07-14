import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Etiquettes } from "./Etiquettes";
import type { ServiceSimule } from "../types";

const pourcent = (n: number) => `${(n * 100).toFixed(0)} %`;

/**
 * DIAGNOSTIC : pourquoi tel service est écarté.
 *
 * Ce n'est PAS ce que voit la collectivité — pour ça, il y a l'aperçu, qui rend la réponse réelle
 * de l'API, réglages compris.
 *
 * CET ÉCRAN PORTAIT UN CURSEUR QUI RECALCULAIT `retenu` DANS LE NAVIGATEUR. C'était une copie de la
 * décision de l'API, et une copie diverge : le jour où le serveur change sa règle, l'écran continue
 * d'afficher l'ancienne sans que rien ne casse. Un outil qui ment sur ce que voit la collectivité
 * est pire que pas d'outil. Le seuil est désormais un PARAMÈTRE de l'API, réglable depuis l'aperçu :
 * c'est elle qui décide, avec le réglage qu'on lui demande d'appliquer.
 *
 * Ce qui reste ici, et qui a de la valeur : voir les candidats ÉCARTÉS avec leur score, tel que le
 * serveur l'a calculé. L'aperçu, lui, ne montre que les retenus — il ne dit donc pas pourquoi les
 * autres manquent.
 */
export function Services({ services, seuilApi }: { services: ServiceSimule[]; seuilApi: number }) {
  const retenus = services.filter((s) => s.retenu).length;
  // LE vrai diagnostic : un service sans aucune étiquette commune ne peut pas remonter, quel que
  // soit le seuil. C'est la classification qu'il faut réparer, pas le réglage.
  const sansRecouvrement = services.filter((s) => s.score === 0).length;
  const candidats = services.filter((s) => s.score > 0 || s.retenu);

  return (
    <section className={fr.cx("fr-mt-6w")}>
      <h2 className={fr.cx("fr-h4")}>Services — diagnostic</h2>

      <div className={fr.cx("fr-callout", "fr-mb-3w")}>
        <p className={fr.cx("fr-text--sm", "fr-mb-1w")}>
          Seuil de l&apos;API : <strong>{seuilApi.toFixed(2)}</strong>.{" "}
          <Badge severity={retenus > 0 ? "success" : "warning"} noIcon>
            {retenus} retenu(s) sur {services.length}
          </Badge>{" "}
          <span className={fr.cx("fr-text--xs")}>
            (pour tester un autre seuil, utilisez l&apos;aperçu : c&apos;est l&apos;API qui l&apos;applique)
          </span>
        </p>
        <p className={fr.cx("fr-text--sm", "fr-mb-0")}>
          <strong>{sansRecouvrement}</strong> services ne partagent <strong>aucune</strong> étiquette avec ce projet :
          aucun seuil ne les fera remonter. C&apos;est la classification qu&apos;il faut corriger, pas le réglage. Ils
          ne sont pas listés ci-dessous.
        </p>
      </div>

      <div className={fr.cx("fr-table", "fr-table--sm")}>
        <table>
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col">Score</th>
              <th scope="col" title="Le score brut est modulé par l'adéquation à la phase du projet">
                dont phase
              </th>
              <th scope="col">Verdict de l&apos;API</th>
              <th scope="col">Étiquettes partagées avec le projet</th>
            </tr>
          </thead>
          <tbody>
            {candidats.map((s) => (
              <tr key={s.slug}>
                <td>{s.nom}</td>
                <td>
                  <strong>{s.score.toFixed(2)}</strong>
                </td>
                <td className={fr.cx("fr-text--xs")}>{s.facteurPhase < 1 ? `× ${pourcent(s.facteurPhase)}` : "—"}</td>
                <td>
                  <Badge severity={s.retenu ? "success" : "warning"} noIcon small>
                    {s.retenu ? "rendu" : "écarté"}
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

      {candidats.length === 0 && (
        <p className={fr.cx("fr-text--sm")}>Aucun service ne partage la moindre étiquette avec ce projet.</p>
      )}
    </section>
  );
}
