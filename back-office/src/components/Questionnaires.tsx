import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Etiquettes } from "./Etiquettes";
import type { QuestionnaireSimule } from "../types";

/**
 * Les questionnaires confrontés au projet, TOUS rendus — y compris ceux sous le seuil.
 *
 * Ne montrer que les retenus empêcherait de voir les quasi-retenus, qui sont précisément ceux
 * qui disent si le seuil est bien posé. Un questionnaire à 0,29 sous un seuil de 0,30 est une
 * information ; son absence n'en est pas une.
 */
export function Questionnaires({ questionnaires, seuil }: { questionnaires: QuestionnaireSimule[]; seuil: number }) {
  return (
    <section className={fr.cx("fr-mt-6w")}>
      <h2 className={fr.cx("fr-h4")}>Questionnaires</h2>
      <p className={fr.cx("fr-text--sm")}>Seuil d&apos;éligibilité : {seuil.toFixed(2)}</p>

      {questionnaires.map((q) => {
        const declenchees = q.recommandations.filter((r) => r.declenchee);

        return (
          <div key={q.slug} className={fr.cx("fr-card", "fr-card--no-arrow", "fr-mb-2w")}>
            <div className={fr.cx("fr-card__body")}>
              <div className={fr.cx("fr-card__content", "fr-py-2w")}>
                <h3 className={fr.cx("fr-card__title", "fr-h6", "fr-mb-1w")}>
                  {q.slug}{" "}
                  <Badge severity={q.retenu ? "success" : "warning"} noIcon small>
                    {q.score.toFixed(2)} — {q.retenu ? "proposé" : "non proposé"}
                  </Badge>
                </h3>

                <div className={fr.cx("fr-mb-1w")}>
                  <Etiquettes communes={q.etiquettesCommunes} />
                </div>

                <p className={fr.cx("fr-text--xs", "fr-mb-0")}>
                  statut : {q.statut} — {q.recommandations.length} recommandation
                  {q.recommandations.length > 1 ? "s" : ""}
                  {declenchees.length > 0 && (
                    <>
                      , dont <strong>{declenchees.length} déclenchée(s)</strong> :{" "}
                      {declenchees.map((r) => r.titre).join(", ")}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
