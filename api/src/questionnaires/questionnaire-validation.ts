import { BadRequestException } from "@nestjs/common";
import { interventions } from "@/projet-qualification/classification/const/interventions";
import { sites } from "@/projet-qualification/classification/const/sites";
import { thematiques } from "@/projet-qualification/classification/const/thematiques";
import { AXES, type QuestionnaireDef } from "./questionnaire-contract";

/** La version n'est pas du contenu : elle est posée par la base, jamais validée. */
type Definition = Omit<QuestionnaireDef, "version">;

/**
 * LES GARDE-FOUS DU CHARGEUR, DÉPLACÉS À L'ÉCRITURE.
 *
 * Tant que les questionnaires vivaient dans le dépôt, le chargeur refusait de DÉMARRER si une
 * condition pointait une question inexistante, si une étiquette sortait de la taxonomie fermée, ou
 * si un questionnaire n'exigeait aucune étiquette. C'était brutal, et c'était un filet parfait : le
 * bug ne pouvait pas atteindre la production.
 *
 * En base, ce filet disparaît. On le reconstruit ici, INTÉGRALEMENT : les mêmes vérifications, au
 * même niveau d'exigence, rendues en 400 explicite. Aucune n'a été assouplie — c'était la condition
 * pour accepter de rendre les questionnaires éditables.
 *
 * Chaque message nomme le champ fautif ET ce qui était attendu. Une personne qui édite depuis le
 * back-office n'a pas accès au code : le message d'erreur est tout ce qu'elle a.
 */

const REFERENTIELS = {
  thematiques: new Set<string>(thematiques),
  sites: new Set<string>(sites),
  interventions: new Set<string>(interventions),
};

const LIBELLE_AXE: Record<(typeof AXES)[number], string> = {
  thematiques: "thématique",
  sites: "lieu",
  interventions: "modalité",
};

export function validerDefinition(def: Omit<QuestionnaireDef, "version">): void {
  validerEtiquettes(def);
  validerQuestions(def);
  validerRecommandations(def);
}

/**
 * Les étiquettes appartiennent aux taxonomies fermées, et il y en a AU MOINS UNE.
 *
 * Le second point est contre-intuitif, et c'est le plus dangereux : une conjonction VIDE est VRAIE.
 * Un questionnaire qui n'exigerait rien serait proposé à TOUS les projets de France, sans
 * exception. Mieux vaut refuser l'enregistrement.
 */
function validerEtiquettes(def: Definition): void {
  const requises = def.etiquettesRequises;

  const total = AXES.reduce((n, axe) => n + (requises[axe]?.length ?? 0), 0);
  if (total === 0) {
    throw new BadRequestException(
      `Questionnaire "${def.slug}" : aucune étiquette requise. Il serait proposé à TOUS les projets ` +
        `(une conjonction vide est vraie). Déclarez au moins une thématique, un lieu ou une modalité.`,
    );
  }

  for (const axe of AXES) {
    for (const label of requises[axe] ?? []) {
      if (!REFERENTIELS[axe].has(label)) {
        throw new BadRequestException(
          `Questionnaire "${def.slug}" : ${LIBELLE_AXE[axe]} « ${label} » hors de la taxonomie du schéma ` +
            `commun. Une étiquette mal orthographiée ferait que le questionnaire n'est JAMAIS proposé, ` +
            `sans le moindre message.`,
        );
      }
    }
  }
}

/** Ids uniques : deux questions homonymes rendraient la réponse de l'une indiscernable de l'autre. */
function validerQuestions(def: Definition): void {
  if (def.questions.length === 0) {
    throw new BadRequestException(`Questionnaire "${def.slug}" : aucune question.`);
  }

  const vues = new Set<string>();
  for (const question of def.questions) {
    if (vues.has(question.id)) {
      throw new BadRequestException(`Questionnaire "${def.slug}" : deux questions portent l'id "${question.id}".`);
    }
    vues.add(question.id);

    if (question.options.length === 0) {
      throw new BadRequestException(`Question "${question.id}" : aucune option — elle serait sans réponse possible.`);
    }

    const options = new Set<string>();
    for (const option of question.options) {
      if (options.has(option.id)) {
        throw new BadRequestException(
          `Question "${question.id}" : deux options portent l'id "${option.id}". La réponse de la ` +
            `collectivité serait ambiguë.`,
        );
      }
      options.add(option.id);
    }
  }
}

/**
 * Une condition qui pointe une question ou une option inexistante est presque toujours une coquille
 * — et elle serait AUTREMENT INDÉTECTABLE : la recommandation ne s'afficherait simplement jamais.
 * C'est le garde-fou le plus important de ce fichier.
 */
function validerRecommandations(def: Definition): void {
  const questionsParId = new Map(def.questions.map((q) => [q.id, q]));
  const vues = new Set<string>();

  for (const reco of def.recommandations) {
    if (vues.has(reco.id)) {
      throw new BadRequestException(`Questionnaire "${def.slug}" : deux recommandations portent l'id "${reco.id}".`);
    }
    vues.add(reco.id);

    for (const financement of reco.financements) {
      // On ne peut vérifier que la FORME. PAS l'existence : Aides-territoires ne sait pas récupérer
      // une aide par son identifiant (`/aids/<id>/` → 404, `?id=<n>` silencieusement ignoré). On ne
      // saura donc qu'un id est bon qu'au moment où MEC tentera l'ajout, sur le périmètre d'un
      // projet — et un id parfaitement valide peut y échouer légitimement : une aide régionale n'est
      // pas disponible partout.
      if (financement.aideId !== undefined && (!Number.isInteger(financement.aideId) || financement.aideId <= 0)) {
        throw new BadRequestException(
          `Recommandation "${reco.id}" : le financement « ${financement.libelle} » porte un aideId ` +
            `invalide (${financement.aideId}). Attendu : l'identifiant Aides-territoires, un entier positif.`,
        );
      }
    }

    // `true` = inconditionnelle : elle sort dès que le questionnaire est entamé.
    if (reco.condition === true) continue;

    const question = questionsParId.get(reco.condition.question);
    if (!question) {
      throw new BadRequestException(
        `Recommandation "${reco.id}" : sa condition porte sur la question "${reco.condition.question}", ` +
          `qui n'existe pas (questions connues : ${[...questionsParId.keys()].join(", ")}). La ` +
          `recommandation ne s'afficherait jamais.`,
      );
    }

    const inconnues = reco.condition.parmi.filter((o) => !question.options.some((opt) => opt.id === o));
    if (inconnues.length > 0) {
      throw new BadRequestException(
        `Recommandation "${reco.id}" : sa condition cite des options inconnues de la question ` +
          `"${question.id}" : ${inconnues.join(", ")} (options connues : ` +
          `${question.options.map((o) => o.id).join(", ")}). La recommandation ne s'afficherait jamais.`,
      );
    }
  }
}
