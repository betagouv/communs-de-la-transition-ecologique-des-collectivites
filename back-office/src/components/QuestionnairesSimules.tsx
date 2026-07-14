import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import type { QuestionnaireSimule } from "../types";

const LIBELLE_AXE: Record<string, string> = {
  thematiques: "thématique",
  sites: "lieu",
  interventions: "modalité",
};

/**
 * Les questionnaires confrontés au projet, TOUS rendus — proposés comme non proposés.
 *
 * L'éligibilité est un CRITÈRE, pas un score : on affiche donc ce qui MANQUE au projet, jamais un
 * chiffre. « non proposé, score 0,11 » n'apprend rien et ne se corrige pas. « il manque le lieu
 * Place ou centre-bourg » dit exactement quoi regarder : soit la classification du projet est
 * fausse, soit le questionnaire vise autre chose.
 */
export function QuestionnairesSimules({ questionnaires }: { questionnaires: QuestionnaireSimule[] }) {
  return (
    <section className={fr.cx("fr-mt-6w")}>
      <h2 className={fr.cx("fr-h4")}>Questionnaires</h2>
      <p className={fr.cx("fr-text--sm")}>
        Un questionnaire est proposé si le projet porte <strong>toutes</strong> ses étiquettes définissantes, avec une
        confiance ≥ 0,80.
      </p>

      {questionnaires.map((q) => {
        const declenchees = q.recommandations.filter((r) => r.declenchee);

        return (
          <div key={q.slug} className={fr.cx("fr-card", "fr-card--no-arrow", "fr-mb-2w")}>
            <div className={fr.cx("fr-card__body")}>
              <div className={fr.cx("fr-card__content", "fr-py-2w")}>
                <h3 className={fr.cx("fr-card__title", "fr-h6", "fr-mb-1w")}>
                  {q.slug}{" "}
                  <Badge severity={q.retenu ? "success" : "warning"} noIcon small>
                    {q.retenu ? "proposé" : "non proposé"}
                  </Badge>
                </h3>

                {q.etiquettesManquantes.length > 0 && (
                  <p className={fr.cx("fr-text--sm", "fr-mb-1w")}>
                    Il manque au projet :{" "}
                    {q.etiquettesManquantes.map((e, i) => (
                      <span key={`${e.axe}-${e.label}`}>
                        {i > 0 && ", "}
                        <strong>{e.label}</strong> <span className={fr.cx("fr-text--xs")}>({LIBELLE_AXE[e.axe]})</span>
                      </span>
                    ))}
                  </p>
                )}

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
