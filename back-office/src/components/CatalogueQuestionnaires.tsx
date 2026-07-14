import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Editeur } from "./Editeur";
import { supprimerQuestionnaire } from "../api";
import { AXES, LIBELLE_AXE, type QuestionnaireContenu, type Taxonomies } from "../types";

/**
 * Le catalogue des questionnaires, et leur édition.
 *
 * Ils vivaient dans le dépôt : les éditer demandait une PR et un déploiement. Ils sont désormais en
 * base, et cet écran est la porte. L'API valide TOUT à l'écriture (les mêmes règles qui, avant,
 * empêchaient l'API de démarrer) : ce que cet écran affiche est donc ce qui sera réellement appliqué.
 */
export function CatalogueQuestionnaires({
  questionnaires,
  taxonomies,
  onChangement,
}: {
  questionnaires: QuestionnaireContenu[];
  taxonomies: Taxonomies;
  onChangement: () => void;
}) {
  const [edite, setEdite] = useState<QuestionnaireContenu | { slug: string } | null>(null);
  const [nouveauSlug, setNouveauSlug] = useState("");

  if (edite) {
    return (
      <Editeur
        questionnaire={edite}
        taxonomies={taxonomies}
        onEnregistre={() => {
          setEdite(null);
          onChangement();
        }}
        onAnnule={() => setEdite(null)}
      />
    );
  }

  const supprimer = async (slug: string) => {
    // Les réponses des collectivités ne sont PAS effacées : elles cessent d'être lues. Si le
    // questionnaire est recréé sous le même slug, elles reviennent. Le dire, plutôt que de laisser
    // croire à une destruction.
    if (
      !confirm(`Supprimer « ${slug} » ?\n\nLes réponses déjà données ne sont pas effacées : elles cessent d'être lues.`)
    )
      return;
    await supprimerQuestionnaire(slug);
    onChangement();
  };

  return (
    <section className={fr.cx("fr-mt-4w")}>
      {questionnaires.map((q) => (
        <div key={q.slug} className={fr.cx("fr-card", "fr-card--no-arrow", "fr-mb-2w")}>
          <div className={fr.cx("fr-card__body")}>
            <div className={fr.cx("fr-card__content", "fr-py-2w")}>
              <h3 className={fr.cx("fr-card__title", "fr-h6", "fr-mb-1w")}>
                {q.slug} <span className={fr.cx("fr-text--sm")}>— version {q.version}</span>
              </h3>

              <p className={fr.cx("fr-text--sm", "fr-mb-1w")}>
                Proposé si le projet porte <strong>toutes</strong> ces étiquettes :{" "}
                {AXES.flatMap((axe) =>
                  q.etiquettesRequises[axe].map((label) => (
                    <span key={`${axe}-${label}`} title={LIBELLE_AXE[axe].singulier}>
                      <Badge severity="success" noIcon small>
                        {label}
                      </Badge>{" "}
                    </span>
                  )),
                )}
              </p>

              <p className={fr.cx("fr-text--xs", "fr-mb-2w")}>
                {q.questions.length} question{q.questions.length > 1 ? "s" : ""} — {q.recommandations.length}{" "}
                recommandation{q.recommandations.length > 1 ? "s" : ""}
              </p>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button size="small" onClick={() => setEdite(q)}>
                  Éditer
                </Button>
                <Button size="small" priority="secondary" onClick={() => void supprimer(q.slug)}>
                  Supprimer
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className={fr.cx("fr-callout", "fr-mt-4w")}>
        <h3 className={fr.cx("fr-h6")}>Créer un questionnaire</h3>
        <Input
          label="Identifiant (slug)"
          hintText="En minuscules, sans espace. Il ne change plus ensuite : les réponses des collectivités y sont attachées."
          nativeInputProps={{
            value: nouveauSlug,
            onChange: (e) => setNouveauSlug(e.target.value),
            placeholder: "atoutbiodiv-cimetiere",
          }}
        />
        <Button
          disabled={!nouveauSlug.trim() || questionnaires.some((q) => q.slug === nouveauSlug.trim())}
          onClick={() => setEdite({ slug: nouveauSlug.trim() })}
        >
          Créer
        </Button>
      </div>
    </section>
  );
}
