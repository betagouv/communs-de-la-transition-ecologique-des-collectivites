import { QuestionnaireDef, type QuestionnaireFichier, type RecommandationsFichier } from "../questionnaire-contract";
import { ETIQUETTES_REQUISES } from "./classification";

import piste from "./questionnaires/atoutbiodiv-piste.json";
import place from "./questionnaires/atoutbiodiv-place.json";
import salle from "./questionnaires/atoutbiodiv-salle.json";
import solaire from "./questionnaires/atoutbiodiv-solaire.json";

import recosPiste from "./recommandations/atoutbiodiv-piste.json";
import recosPlace from "./recommandations/atoutbiodiv-place.json";
import recosSalle from "./recommandations/atoutbiodiv-salle.json";
import recosSolaire from "./recommandations/atoutbiodiv-solaire.json";

// Les JSON sont produits par le partenaire (AtoutBiodiv) et relus en PR — c'est l'étape
// « validé avec nous ». Le typage ne peut pas être inféré depuis le JSON (TypeScript
// élargit les littéraux), d'où le cast : la cohérence réelle est vérifiée ci-dessous par
// `assembler`, au démarrage, et non à la compilation.
const FICHIERS_QUESTIONNAIRES = [piste, place, salle, solaire] as unknown as QuestionnaireFichier[];
const FICHIERS_RECOMMANDATIONS = [
  recosPiste,
  recosPlace,
  recosSalle,
  recosSolaire,
] as unknown as RecommandationsFichier[];

/**
 * Assemble un questionnaire : contenu partenaire + recommandations + classification
 * d'éligibilité (détenue par Communs). Toute incohérence est une ERREUR AU DÉMARRAGE, pas
 * une recommandation qui disparaît silencieusement en production : une `condition` qui
 * pointe une question ou une option inexistante est presque toujours une coquille dans la
 * PR de contenu, et elle serait autrement indétectable (la recommandation ne s'afficherait
 * simplement jamais).
 */
export function assembler(fichier: QuestionnaireFichier): QuestionnaireDef {
  const { slug } = fichier;

  // Les fichiers d'origine portaient un bloc `eligibilite` ({ thematiques, competences })
  // rédigé dans le vocabulaire thématique de MEC — un vocabulaire que l'API ne connaît pas
  // (cf. classification.ts). Il n'a jamais pu servir, et l'y laisser serait un piège : un
  // éditeur croirait qu'il agit alors qu'il est ignoré. On refuse donc de démarrer plutôt
  // que de l'ignorer en silence.
  if ("eligibilite" in fichier) {
    throw new Error(
      `Questionnaire "${slug}" : le champ "eligibilite" n'est plus supporté. L'éligibilité est décidée ` +
        `par Communs : le projet doit porter les étiquettes définissantes du questionnaire — déclarez-les ` +
        `dans content/classification.ts (taxonomies fermées : thematiques, sites, interventions).`,
    );
  }

  const etiquettesRequises = ETIQUETTES_REQUISES[slug];
  if (!etiquettesRequises) {
    throw new Error(
      `Questionnaire "${slug}" : aucune étiquette d'éligibilité (content/classification.ts). ` +
        `Sans elle, le questionnaire ne serait jamais proposé à aucun projet.`,
    );
  }

  // Une liste vide sur les trois axes serait pire qu'une absence : le questionnaire n'exigerait
  // RIEN, donc il serait proposé à TOUS les projets. Une conjonction vide est vraie.
  const nbEtiquettes =
    etiquettesRequises.thematiques.length + etiquettesRequises.sites.length + etiquettesRequises.interventions.length;
  if (nbEtiquettes === 0) {
    throw new Error(
      `Questionnaire "${slug}" : aucune étiquette requise. Il serait proposé à TOUS les projets ` +
        `(une conjonction vide est vraie). Déclarez au moins une étiquette dans content/classification.ts.`,
    );
  }

  const fichierRecos = FICHIERS_RECOMMANDATIONS.find((r) => r.questionnaireSlug === slug);
  if (!fichierRecos) {
    throw new Error(`Questionnaire "${slug}" : aucun fichier de recommandations correspondant.`);
  }

  const questionsParId = new Map(fichier.questions.map((q) => [q.id, q]));

  for (const reco of fichierRecos.recommandations) {
    if (reco.condition === true) continue;

    const question = questionsParId.get(reco.condition.question);
    if (!question) {
      throw new Error(
        `Recommandation "${slug}:${reco.id}" : condition sur la question inconnue ` +
          `"${reco.condition.question}" (connues : ${[...questionsParId.keys()].join(", ")}).`,
      );
    }
    const optionsInconnues = reco.condition.parmi.filter((o) => !question.options.some((opt) => opt.id === o));
    if (optionsInconnues.length > 0) {
      throw new Error(
        `Recommandation "${slug}:${reco.id}" : condition sur des options inconnues de la question ` +
          `"${question.id}" : ${optionsInconnues.join(", ")} ` +
          `(connues : ${question.options.map((o) => o.id).join(", ")}).`,
      );
    }
  }

  return { ...fichier, etiquettesRequises, recommandations: fichierRecos.recommandations };
}

/**
 * Registre des questionnaires. Source de vérité du CONTENU : les JSON de content/,
 * versionnés en Git. Les basculer plus tard vers une table ou un dépôt de schémas chargé au
 * démarrage ne demandera de réécrire ni le moteur, ni les services — seul ce fichier change.
 */
export const QUESTIONNAIRES: readonly QuestionnaireDef[] = FICHIERS_QUESTIONNAIRES.map(assembler);

export function questionnaireParSlug(slug: string): QuestionnaireDef | undefined {
  return QUESTIONNAIRES.find((q) => q.slug === slug);
}
