// ============================================================
// Contrat des questionnaires spécialisés
// ============================================================
//
// Un questionnaire est du CONTENU éditorial produit par un partenaire (AtoutBiodiv) et
// validé avec nous : il vit en JSON dans content/questionnaires/ et content/recommandations/,
// versionné en Git et relu en PR. Ce fichier n'en définit que la FORME et l'évaluation.
//
// Frontière stricte : `condition` (et la classification d'éligibilité) ne sortent JAMAIS de
// l'API. Elles sont évaluées côté serveur, et les DTO de réponse ne les portent pas. Exposer
// une condition serait une fuite de logique métier vers le client — la spec l'interdit.

/**
 * Étiquettes qui DÉFINISSENT un questionnaire. Le projet doit TOUTES les porter (confiance ≥
 * SEUIL_CONFIANCE) pour qu'il lui soit proposé.
 *
 * `string[]` et non `Thematique[]` : les valeurs viennent d'un jsonb, éditable depuis le
 * back-office. Un typage littéral ne protégerait plus rien — c'est `validerDefinition` qui vérifie
 * l'appartenance aux taxonomies fermées, et lui seul peut le faire à l'écriture.
 */
export interface EtiquettesRequises {
  thematiques: readonly string[];
  sites: readonly string[];
  interventions: readonly string[];
}

/** Les trois axes du schéma commun. */
export const AXES = ["thematiques", "sites", "interventions"] as const;
export type Axe = (typeof AXES)[number];

/**
 * Confiance minimale de l'étiquette DANS LA CLASSIFICATION DU PROJET pour qu'elle compte.
 * Même valeur que le seuil du moteur de matching des aides : en dessous, le job LLM n'est pas assez
 * sûr de lui pour qu'on agisse dessus.
 */
export const SEUIL_CONFIANCE = 0.8;

export const SIGNAUX = ["favorable", "vigilance", "neutre"] as const;
export type Signal = (typeof SIGNAUX)[number];

export const TONS_FEEDBACK = ["success", "warning", "info"] as const;
export type TonFeedback = (typeof TONS_FEEDBACK)[number];

export const TYPES_QUESTION = ["choix-unique"] as const;
export type TypeQuestion = (typeof TYPES_QUESTION)[number];

export const STATUTS_QUESTIONNAIRE = ["non_commence", "en_cours", "complet"] as const;
export type StatutQuestionnaire = (typeof STATUTS_QUESTIONNAIRE)[number];

// ------------------------------------------------------------
// Contenu partenaire : questionnaire
// ------------------------------------------------------------

export interface OptionDef {
  id: string;
  libelle: string;
  aide?: string;
  signal: Signal;
  feedback?: { ton: TonFeedback; message: string };
}

export interface QuestionDef {
  id: string;
  type: TypeQuestion;
  intitule: string;
  options: OptionDef[];
}

export interface BanniereDef {
  icone?: string;
  titre: string;
  sousTitre: string;
}

/**
 * Fichier content/questionnaires/<slug>.json, tel que le partenaire l'écrit.
 *
 * Il ne porte QUE du contenu affichable : ni éligibilité, ni condition. L'éligibilité est
 * décidée par Communs (spec §2 : « toute la logique métier vit dans Communs »), par score de
 * matching sur les trois axes de classification — voir content/classification.ts. Un fichier
 * qui porterait encore un champ `eligibilite` est rejeté au démarrage (cf. content/index.ts).
 */
export interface QuestionnaireFichier {
  slug: string;
  version: number;
  source: { nom: string };
  banniere: BanniereDef;
  questions: QuestionDef[];
}

// ------------------------------------------------------------
// Contenu partenaire : recommandations
// ------------------------------------------------------------

/**
 * Un financement cité par une recommandation.
 *
 * `aideId` — l'identifiant Aides-territoires, QUAND le financement désigne une aide précise. Il
 * permet à MEC de proposer « ajouter cette aide au projet » (POST /projets/:id/aides/ajouts) sans
 * que l'agent ait à la retrouver à la main.
 *
 * FACULTATIF, et ça n'est pas une négligence : beaucoup de financements désignent une FAMILLE
 * d'aides, pas une aide (« Fonds vert — Biodiversité », « DETR »), et leur `url` est une recherche,
 * pas une fiche. Les forcer à porter un id obligerait à en inventer un — donc à envoyer une
 * collectivité vers la mauvaise aide.
 *
 * ON NE PEUT PAS VÉRIFIER À L'ÉCRITURE QU'UN ID EXISTE : Aides-territoires ne sait pas récupérer
 * une aide par son identifiant (`/aids/<id>/` répond 404, et `?id=<n>` est silencieusement ignoré).
 * On ne le saura qu'au moment de l'ajout, contre le périmètre d'un projet. Un id valide peut
 * d'ailleurs légitimement échouer là : une aide d'Agence de l'Eau Adour-Garonne n'est pas
 * disponible pour une commune bretonne. Ce n'est pas un bug, c'est le territoire.
 */
export interface FinancementDef {
  icone?: string;
  libelle: string;
  description?: string;
  url: string;
  aideId?: number;
}

export interface RessourceDef {
  icone?: string;
  source: string;
  nom: string;
  description?: string;
  url: string;
}

/**
 * Condition de contribution d'une recommandation, évaluée contre les réponses.
 * `true` = inconditionnelle — mais même inconditionnelle, elle ne contribue pas tant que le
 * questionnaire est `non_commence` (cf. QuestionnaireRecommandationSource).
 * NE SORT JAMAIS DE L'API.
 */
export type Condition = true | { question: string; parmi: string[] };

export interface RecommandationDef {
  /** Clé locale au questionnaire. L'id exposé est namespacé (cf. RecommandationsService). */
  id: string;
  icone?: string;
  titre: string;
  description: string;
  condition: Condition;
  financements: FinancementDef[];
  ressources: RessourceDef[];
  engagement: string;
}

/** Fichier content/recommandations/<slug>.json. */
export interface RecommandationsFichier {
  questionnaireSlug: string;
  recommandations: RecommandationDef[];
}

// ------------------------------------------------------------
// Questionnaire assemblé (contenu + éligibilité détenue par Communs)
// ------------------------------------------------------------

export interface QuestionnaireDef extends QuestionnaireFichier {
  /**
   * Étiquettes qui DÉFINISSENT le questionnaire, dans les taxonomies fermées du schéma commun.
   * Le projet doit TOUTES les porter (confiance ≥ SEUIL_CONFIANCE) pour que le questionnaire lui
   * soit proposé. Détenues par Communs, pas par le partenaire. NE SORTENT JAMAIS DE L'API.
   */
  etiquettesRequises: EtiquettesRequises;
  recommandations: RecommandationDef[];
}

// ------------------------------------------------------------
// Évaluation
// ------------------------------------------------------------

/** Vraie si la recommandation doit contribuer, au regard des réponses enregistrées. */
export function evaluerCondition(condition: Condition, reponses: Record<string, string>): boolean {
  if (condition === true) return true;
  const reponse = reponses[condition.question];
  return reponse !== undefined && condition.parmi.includes(reponse);
}

/**
 * Écarte les réponses devenues ininterprétables au regard de la définition COURANTE :
 * question disparue, ou option disparue de la question. C'est ce qui rend un bump de
 * `version` non destructeur et sans migration — les réponses encore valides survivent,
 * les autres sont ignorées à la lecture (la ligne stockée n'est pas réécrite tant que la
 * collectivité ne repasse pas un PUT).
 */
export function reconcilierReponses(def: QuestionnaireDef, reponses: Record<string, string>): Record<string, string> {
  const retenues: Record<string, string> = {};
  for (const question of def.questions) {
    const reponse = reponses[question.id];
    if (reponse !== undefined && question.options.some((o) => o.id === reponse)) {
      retenues[question.id] = reponse;
    }
  }
  return retenues;
}

/** non_commence : aucune réponse. complet : toutes les questions répondues. en_cours : entre les deux. */
export function calculerStatut(def: QuestionnaireDef, reponses: Record<string, string>): StatutQuestionnaire {
  const repondues = def.questions.filter((q) => reponses[q.id] !== undefined).length;
  if (repondues === 0) return "non_commence";
  return repondues === def.questions.length ? "complet" : "en_cours";
}
