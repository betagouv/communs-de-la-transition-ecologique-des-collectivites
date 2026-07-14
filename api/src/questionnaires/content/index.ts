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
 * ASSEMBLE une définition d'amorçage : JSON partenaire + recommandations + étiquettes.
 *
 * PUR CHARGEUR. Il ne valide QUE ce qui relève de l'assemblage : un champ hérité qui traîne, un
 * fichier de recommandations manquant, une entrée absente d'ETIQUETTES_REQUISES. Tout le reste —
 * étiquettes dans la taxonomie, conditions résolubles, ids uniques — est jugé par
 * `validerDefinition`, SEULE autorité, que le script d'amorçage appelle comme le fait toute
 * écriture. Deux jeux de règles sur le même invariant divergent : les nôtres l'avaient déjà fait.
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
        `par Communs : le projet doit porter les étiquettes définissantes du questionnaire.`,
    );
  }

  const etiquettesRequises = ETIQUETTES_REQUISES[slug];
  if (!etiquettesRequises) {
    throw new Error(
      `Questionnaire "${slug}" : aucune étiquette d'éligibilité (content/classification.ts). ` +
        `Sans elle, le questionnaire ne serait jamais proposé à aucun projet.`,
    );
  }

  const fichierRecos = FICHIERS_RECOMMANDATIONS.find((r) => r.questionnaireSlug === slug);
  if (!fichierRecos) {
    throw new Error(`Questionnaire "${slug}" : aucun fichier de recommandations correspondant.`);
  }

  return { ...fichier, etiquettesRequises, recommandations: fichierRecos.recommandations };
}

/**
 * Définitions d'AMORÇAGE. Ce ne sont plus la source de vérité : la base l'est, éditable depuis le
 * back-office. Ces JSON ne servent qu'à `pnpm seed:questionnaires`, comme le CSV DINUM sert à
 * amorcer le catalogue de services.
 */
export const QUESTIONNAIRES: readonly QuestionnaireDef[] = FICHIERS_QUESTIONNAIRES.map(assembler);
