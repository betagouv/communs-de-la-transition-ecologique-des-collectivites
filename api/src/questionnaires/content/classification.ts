import type { Intervention } from "@/projet-qualification/classification/const/interventions";
import type { Site } from "@/projet-qualification/classification/const/sites";
import type { Thematique } from "@/projet-qualification/classification/const/thematiques";

/**
 * Étiquettes qui DÉFINISSENT chaque questionnaire, sur les trois axes du schéma commun.
 *
 * POURQUOI CE FICHIER EXISTE. Les fichiers partenaires portent un bloc `eligibilite`
 * ({ thematiques: ["Équipements et services publics"], competences: [] }) rédigé dans le
 * vocabulaire thématique de MEC. Ce vocabulaire n'existe PAS dans les taxonomies fermées de
 * l'API, bien plus fines (137 thématiques). Une règle sur ces libellés n'aurait matché aucun
 * projet, silencieusement. L'éligibilité est donc décidée par Communs (spec §2), ici.
 *
 * POURQUOI UNE RÈGLE PAR ÉTIQUETTE, ET NON UN SCORE. Un questionnaire n'est pas une aide.
 * Une aide ressemble plus ou moins à un projet — un score a du sens. Un questionnaire, lui,
 * est défini par un critère : c'est une salle des fêtes, ou ce n'en est pas une.
 *
 * Le score de matching a d'ailleurs été essayé, et il échoue ici pour une raison structurelle :
 * il normalise par le maximum du PROJET. Deux projets portant tous deux « Place ou centre-bourg »
 * obtenaient 1,00 et 0,11 selon que leur classification était pauvre ou riche — le second était
 * écarté alors qu'il est bel et bien une place. Un critère ne doit pas dépendre de la largeur de
 * la classification d'à côté.
 *
 * LA RÈGLE. Le questionnaire est proposé si le projet porte TOUTES ses étiquettes définissantes,
 * avec une confiance ≥ SEUIL_CONFIANCE. Toutes, et non au moins une : sur `atoutbiodiv-solaire`,
 * « école » seule attraperait n'importe quel projet d'école, et « solaire » seul n'importe quelle
 * installation photovoltaïque. C'est la conjonction qui définit le questionnaire.
 *
 * Le typage sur Thematique/Site/Intervention est volontaire : une étiquette hors taxonomie ne
 * compile pas.
 */
export interface EtiquettesRequises {
  thematiques: readonly Thematique[];
  sites: readonly Site[];
  interventions: readonly Intervention[];
}

/**
 * Confiance minimale de l'étiquette DANS LA CLASSIFICATION DU PROJET pour qu'elle compte.
 *
 * Même valeur que le seuil du moteur de matching des aides (AidesMatchingService.DEFAULT_THRESHOLD) :
 * en dessous, le job LLM n'est pas assez sûr de lui pour qu'on agisse dessus.
 */
export const SEUIL_CONFIANCE = 0.8;

export const ETIQUETTES_REQUISES: Record<string, EtiquettesRequises> = {
  // Le lieu SEUL définit ce questionnaire.
  "atoutbiodiv-salle": {
    thematiques: [],
    sites: ["Salle des fêtes, salle associative, pôle musical"],
    interventions: [],
  },

  // Idem : le lieu seul. Une place, ou pas une place.
  "atoutbiodiv-place": {
    thematiques: [],
    sites: ["Place ou centre-bourg"],
    interventions: [],
  },

  // Ici c'est la THÉMATIQUE qui définit le questionnaire : la taxonomie n'a aucun lieu
  // « piste cyclable » ni « voie verte », mais elle a la thématique correspondante.
  "atoutbiodiv-piste": {
    thematiques: ["Voie douce, piste cyclable"],
    sites: [],
    interventions: [],
  },

  // Le seul des quatre à exiger DEUX étiquettes, et il le faut : des panneaux solaires SUR UNE
  // ÉCOLE. La thématique seule attraperait n'importe quelle installation solaire ; le lieu seul,
  // n'importe quel projet d'école.
  "atoutbiodiv-solaire": {
    thematiques: ["Agrivoltaïsme, panneaux solaires sur le bâti"],
    sites: ["Ecole"],
    interventions: [],
  },
};
