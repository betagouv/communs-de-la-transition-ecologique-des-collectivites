import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { ChoixEtiquettes } from "./ChoixEtiquettes";
import { enregistrerQuestionnaire } from "../api";
import type { Axe, QuestionnaireContenu, QuestionnaireEdition, Taxonomies } from "../types";

const AXES: Axe[] = ["thematiques", "sites", "interventions"];

const VIDE = { thematiques: [], sites: [], interventions: [] };

/**
 * Édition d'un questionnaire.
 *
 * DEUX PARTIES, DEUX TRAITEMENTS, et ce n'est pas un compromis paresseux :
 *
 * - Les ÉTIQUETTES sont éditées par sélecteur sur la taxonomie fermée. C'est là que la saisie libre
 *   est le plus dangereuse : une coquille et le questionnaire n'est JAMAIS proposé, sans le moindre
 *   message. Le sélecteur rend la faute impossible.
 *
 * - Le CONTENU (bandeau, questions, recommandations) est édité en JSON. Un formulaire structuré
 *   serait plus agréable, mais il doit modéliser les conditions, les signaux, les financements et
 *   les ressources : c'est un chantier à part entière, et un mauvais formulaire est pire qu'un JSON
 *   honnête. L'API valide tout de toute façon, et ses messages s'affichent ici tels quels.
 *
 * LA VALIDATION N'EST PAS FAITE ICI. Elle vit dans l'API (questionnaire-validation.ts), qui est le
 * seul endroit où l'on ne peut pas passer à côté. La rejouer dans cet écran donnerait deux règles à
 * tenir en phase — et celle du client serait contournable.
 */
export function Editeur({
  questionnaire,
  taxonomies,
  onEnregistre,
  onAnnule,
}: {
  questionnaire: QuestionnaireContenu | { slug: string };
  taxonomies: Taxonomies;
  onEnregistre: () => void;
  onAnnule: () => void;
}) {
  const existant = "questions" in questionnaire ? questionnaire : null;

  const [sourceNom, setSourceNom] = useState(existant?.libelle ?? "AtoutBiodiv");
  const [etiquettes, setEtiquettes] = useState<Taxonomies>(existant?.etiquettesRequises ?? VIDE);
  const [contenu, setContenu] = useState(() =>
    JSON.stringify(
      {
        banniere: existant?.banniere ?? { icone: "🌿", titre: "", sousTitre: "" },
        questions: existant?.questions ?? [],
        recommandations: existant?.recommandations ?? [],
      },
      null,
      2,
    ),
  );

  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const total = AXES.reduce((n, axe) => n + etiquettes[axe].length, 0);

  const enregistrer = async () => {
    setErreur(null);

    // Le JSON mal formé est la SEULE chose qu'on vérifie ici : sans lui, on n'aurait rien à envoyer.
    // Tout le reste — étiquettes, conditions, ids — est jugé par l'API.
    let parse: Omit<QuestionnaireEdition, "sourceNom" | "etiquettesRequises">;
    try {
      parse = JSON.parse(contenu) as typeof parse;
    } catch (e) {
      setErreur(`JSON invalide : ${e instanceof Error ? e.message : "erreur de syntaxe"}`);
      return;
    }

    setEnregistrement(true);
    try {
      await enregistrerQuestionnaire(questionnaire.slug, {
        sourceNom,
        banniere: parse.banniere,
        questions: parse.questions,
        recommandations: parse.recommandations,
        etiquettesRequises: etiquettes,
      });
      onEnregistre();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <section className={fr.cx("fr-mt-3w")}>
      <h2 className={fr.cx("fr-h5")}>
        {existant ? "Éditer" : "Créer"} <code>{questionnaire.slug}</code>
        {existant && <span className={fr.cx("fr-text--sm")}> — version {existant.version}</span>}
      </h2>

      {erreur && (
        <Alert
          severity="error"
          title="L'API a refusé l'enregistrement"
          description={erreur}
          className={fr.cx("fr-mb-3w")}
        />
      )}

      <Input
        label="Partenaire fournissant le contenu"
        nativeInputProps={{ value: sourceNom, onChange: (e) => setSourceNom(e.target.value) }}
      />

      <div className={fr.cx("fr-callout", "fr-my-3w")}>
        <h3 className={fr.cx("fr-h6")}>Quand ce questionnaire est-il proposé ?</h3>
        <p className={fr.cx("fr-text--sm")}>
          Le projet doit porter <strong>toutes</strong> les étiquettes ci-dessous, avec une confiance ≥ 0,80.
          {total === 0 && (
            <>
              {" "}
              <strong>Aucune étiquette : l&apos;API refusera.</strong> Un questionnaire qui n&apos;exige rien serait
              proposé à <strong>tous</strong> les projets — une conjonction vide est vraie.
            </>
          )}
        </p>

        {AXES.map((axe) => (
          <ChoixEtiquettes
            key={axe}
            axe={axe}
            disponibles={taxonomies[axe]}
            choisies={etiquettes[axe]}
            onChange={(labels) => setEtiquettes({ ...etiquettes, [axe]: labels })}
          />
        ))}
      </div>

      <Input
        label="Contenu : bandeau, questions, recommandations"
        hintText="JSON. L'API valide les conditions, les identifiants et les options — ses messages s'affichent ci-dessus."
        textArea
        nativeTextAreaProps={{
          value: contenu,
          onChange: (e) => setContenu(e.target.value),
          rows: 22,
          style: { fontFamily: "monospace", fontSize: "0.8rem" },
        }}
      />

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button onClick={() => void enregistrer()} disabled={enregistrement}>
          {enregistrement ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button priority="secondary" onClick={onAnnule}>
          Annuler
        </Button>
      </div>
    </section>
  );
}
