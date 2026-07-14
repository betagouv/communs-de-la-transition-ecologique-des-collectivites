import type { EtiquettesRequises } from "../questionnaire-contract";

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
 * Ces valeurs ne servent qu'à l'AMORÇAGE (`pnpm seed:questionnaires`). La source de vérité est la
 * base, éditable depuis le back-office. Elles sont validées comme n'importe quelle édition :
 * `validerDefinition` vérifie leur appartenance aux taxonomies fermées, sans privilège.
 */

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
