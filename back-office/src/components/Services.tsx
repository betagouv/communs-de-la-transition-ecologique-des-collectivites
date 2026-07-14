import { useMemo, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { ToggleSwitch } from "@codegouvfr/react-dsfr/ToggleSwitch";
import { Etiquettes } from "./Etiquettes";
import { motifAuSeuil, type Motif, type ServiceSimule } from "../types";

const LIBELLE_MOTIF: Record<Motif, { texte: string; severite: "success" | "info" | "warning" }> = {
  pertinence: { texte: "pertinent", severite: "success" },
  generique: { texte: "repêché", severite: "info" },
  ecarte: { texte: "écarté", severite: "warning" },
};

const pourcent = (n: number) => `${(n * 100).toFixed(0)} %`;

/**
 * Le catalogue de services confronté à un projet, avec un curseur de seuil.
 *
 * POURQUOI UN CURSEUR. L'API renvoie TOUS les candidats avec leur score, pas seulement les
 * retenus : rejouer la sélection à un autre seuil est donc de l'arithmétique locale, sans rappel
 * réseau. On voit l'effet d'un réglage avant de le figer dans le code — c'est la seule façon
 * honnête de choisir un seuil, plutôt que de le deviner puis de constater en production.
 */
export function Services({ services, seuilApi }: { services: ServiceSimule[]; seuilApi: number }) {
  const [seuil, setSeuil] = useState(seuilApi);
  const [masquerEcartes, setMasquerEcartes] = useState(true);

  const { comptes, visibles } = useMemo(() => {
    const avecMotif = services.map((s) => ({ ...s, motifLocal: motifAuSeuil(s, seuil) }));
    const compter = (m: Motif) => avecMotif.filter((s) => s.motifLocal === m).length;

    return {
      comptes: {
        pertinence: compter("pertinence"),
        generique: compter("generique"),
        ecarte: compter("ecarte"),
        // Ce chiffre est le vrai diagnostic : un service qui ne partage AUCUNE étiquette avec le
        // projet ne peut être remonté que par repêchage. Aucun seuil ne le rendra pertinent.
        sansRecouvrement: avecMotif.filter((s) => s.score === 0).length,
      },
      visibles: masquerEcartes ? avecMotif.filter((s) => s.motifLocal !== "ecarte") : avecMotif,
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
          <Badge severity="success" noIcon>
            {comptes.pertinence} pertinents
          </Badge>{" "}
          <Badge severity="info" noIcon>
            {comptes.generique} repêchés
          </Badge>{" "}
          <Badge severity="warning" noIcon>
            {comptes.ecarte} écartés
          </Badge>
        </p>

        <p className={fr.cx("fr-text--sm", "fr-mt-2w", "fr-mb-0")}>
          {comptes.sansRecouvrement} des {services.length} services ne partagent <strong>aucune</strong> étiquette avec
          ce projet : aucun seuil ne les rendra pertinents. Baisser le curseur ne joue que sur les{" "}
          {services.length - comptes.sansRecouvrement} autres.
        </p>
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
            {visibles.map((s) => {
              const { texte, severite } = LIBELLE_MOTIF[s.motifLocal];
              return (
                <tr key={s.slug}>
                  <td>{s.nom}</td>
                  <td>
                    <strong>{s.score.toFixed(2)}</strong>
                  </td>
                  <td className={fr.cx("fr-text--xs")}>{s.facteurPhase < 1 ? `× ${pourcent(s.facteurPhase)}` : "—"}</td>
                  <td>
                    <Badge severity={severite} noIcon small>
                      {texte}
                    </Badge>
                  </td>
                  <td>
                    <Etiquettes communes={s.etiquettesCommunes} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibles.length === 0 && <p className={fr.cx("fr-text--sm")}>Aucun service remonté à ce seuil.</p>}
    </section>
  );
}
