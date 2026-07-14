import { BadRequestException } from "@nestjs/common";

// ============================================================
// Contrat de taxonomie des décisions humaines (V2)
// ============================================================
//
// `typeDecision` est une ENUM FERMÉE : toute valeur hors liste est rejetée (400).
// Chaque type impose ses propres contraintes croisées (objet A/B, verdict, payload),
// vérifiées par `validateDecisionContract` avec un message explicite indiquant le
// champ fautif ET le type concerné. Le contrat est décrit en clair dans
// docs/api/GUIDE_DECISIONS.md.

// Types d'objets référençables par une décision. Les IDs pointés doivent TOUJOURS
// être des IDs objets stables (traces[].id : UUID sources, ids cop_*…), jamais un cluster_id.
export const OBJET_TYPES = ["projet", "fiche_action", "plan", "financement"] as const;
export type ObjetType = (typeof OBJET_TYPES)[number];

// L'objet B peut EN PLUS désigner un PCAET (rattachement_pcaet). Un PCAET n'a pas
// d'id de trace stable propre : les plan_id ont trois canaux (snapshot/opendata/live)
// dont la couverture bouge d'un run à l'autre. On le référence donc par le SIREN de
// son porteur, clé stable de schema_commun_v2.pcaet_reference. 'pcaet' n'est jamais
// un type d'objet A.
// L'objet B peut AUSSI désigner une recommandation (recommandation_arbitrage). Une
// recommandation n'est pas une ligne en base : elle est RECALCULÉE à chaque lecture par
// agrégation des sources. Son id est donc déterministe et stable par construction
// (`questionnaire:<slug>:<cle>` — cf. RecommandationsService), ce qui est précisément ce
// qui permet à l'arbitrage de lui survivre : une recommandation qui disparaît puis
// réapparaît (la collectivité revient sur ses réponses) retrouve son arbitrage.
// 'recommandation' n'est jamais un type d'objet A.
// L'objet B peut ENFIN désigner une aide ou un service numérique (ajout_manuel). On n'y stocke
// QUE l'identifiant : l'id Aides-territoires pour une aide, le slug du catalogue pour un service.
// L'aide est résolue au frais à chaque lecture, dans les aides du périmètre du projet. Si elle a
// été clôturée ou dépubliée entre-temps, elle cesse simplement de s'afficher — c'est le
// comportement correct : mieux vaut ne rien montrer qu'envoyer une collectivité candidater à une
// aide morte. (Aides-territoires ne sait de toute façon PAS récupérer une aide par son id :
// /aids/<id>/ répond 404, et ?id=<n> est silencieusement ignoré — il renvoie tout le catalogue.)
// Ni 'aide' ni 'service_numerique' n'est jamais un type d'objet A.
export const OBJET_B_TYPES = [...OBJET_TYPES, "pcaet", "recommandation", "aide", "service_numerique"] as const;
export type ObjetBType = (typeof OBJET_B_TYPES)[number];

// Vocabulaire fermé des types de décision.
export const DECISION_TYPES = [
  "doublon_signale",
  "doublon_confirme",
  "doublon_infirme",
  "rattachement_pcaet",
  "projet_statut",
  "correction_signalee",
  "recommandation_arbitrage",
  "ajout_manuel",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

// Verdicts de `recommandation_arbitrage`. Le « non tranché » n'est PAS un verdict :
// c'est l'absence de décision active, obtenue soit parce qu'aucune n'a jamais été
// émise, soit par révocation (ANNULE_VERDICT + supersedes).
export const RECOMMANDATION_VERDICTS = ["a_etudier", "integree", "ignoree"] as const;
export type RecommandationVerdict = (typeof RECOMMANDATION_VERDICTS)[number];

// Verdict de RÉVOCATION universel. Valide pour TOUS les types, à la seule condition
// que `supersedes` désigne la décision cible (400 sinon). Sémantique : retire la cible
// sans rien affirmer. Les décisions verdict='annule' sont des pierres tombales :
// exclues de tous les effets de lecture (decisions[], rattachement, obsolètes) — elles
// ne servent qu'à désactiver leur cible via la chaîne `supersedes`.
// (Nécessaire car pour les doublons `verdict` est sinon interdit : sans ce mécanisme,
// la ligne qui supersède serait elle-même une décision active du même type, donc le
// verrou persisterait — la révocation serait inexprimable.)
export const ANNULE_VERDICT = "annule";

// SIREN du porteur PCAET : 9 chiffres.
const SIREN_REGEX = /^\d{9}$/;

// Les signalements/confirmations de doublon lient deux objets « projet » ou « fiche_action ».
const DOUBLON_OBJET_TYPES = ["projet", "fiche_action"] as const;

type ObjetBRule =
  // interdit : objetBType ET objetBId doivent être absents.
  | { required: false }
  // requis : type dans `types`, id éventuellement contraint par un motif.
  | { required: true; types: readonly ObjetBType[]; idPattern?: RegExp; idPatternLabel?: string };

type VerdictRule =
  // interdit : verdict doit être absent.
  | { required: false }
  // requis : verdict dans `values`.
  | { required: true; values: readonly string[] };

// free : payload libre (borné en octets par le DTO). correction : forme imposée.
type PayloadRule = "free" | "correction";

interface DecisionSpec {
  objetATypes: readonly ObjetType[];
  objetB: ObjetBRule;
  verdict: VerdictRule;
  payload: PayloadRule;
}

// Contrat figé — voir le tableau récapitulatif de docs/api/GUIDE_DECISIONS.md.
const CONTRACT: Record<DecisionType, DecisionSpec> = {
  doublon_signale: {
    objetATypes: DOUBLON_OBJET_TYPES,
    objetB: { required: true, types: DOUBLON_OBJET_TYPES },
    verdict: { required: false },
    payload: "free",
  },
  doublon_confirme: {
    objetATypes: DOUBLON_OBJET_TYPES,
    objetB: { required: true, types: DOUBLON_OBJET_TYPES },
    verdict: { required: false },
    payload: "free",
  },
  doublon_infirme: {
    objetATypes: DOUBLON_OBJET_TYPES,
    objetB: { required: true, types: DOUBLON_OBJET_TYPES },
    verdict: { required: false },
    payload: "free",
  },
  rattachement_pcaet: {
    objetATypes: ["projet"],
    objetB: {
      required: true,
      types: ["pcaet"],
      idPattern: SIREN_REGEX,
      idPatternLabel: "un SIREN de 9 chiffres (porteur du PCAET)",
    },
    verdict: { required: true, values: ["confirme", "infirme"] },
    payload: "free",
  },
  projet_statut: {
    objetATypes: ["projet"],
    objetB: { required: false },
    verdict: { required: true, values: ["valide", "obsolete", "termine"] },
    payload: "free",
  },
  correction_signalee: {
    objetATypes: OBJET_TYPES,
    objetB: { required: false },
    verdict: { required: false },
    payload: "correction",
  },
  recommandation_arbitrage: {
    objetATypes: ["projet"],
    objetB: { required: true, types: ["recommandation"] },
    verdict: { required: true, values: RECOMMANDATION_VERDICTS },
    payload: "free",
  },
  // Ajout à la main d'une aide ou d'un service numérique sur un projet, quand le moteur ne l'a
  // pas trouvé (ou l'a mal classé). Le MESSAGE d'accompagnement va dans `commentaire`, qui existe
  // déjà sur toute décision — d'où un payload libre, et vide en pratique.
  //
  // Pas de verdict : la décision EST l'ajout. Le retrait se fait par la révocation universelle
  // (verdict='annule' + supersedes) — inutile d'inventer un verdict "retire" qui ferait double
  // emploi et créerait deux façons de dire la même chose.
  ajout_manuel: {
    objetATypes: ["projet"],
    objetB: { required: true, types: ["aide", "service_numerique"] },
    verdict: { required: false },
    payload: "free",
  },
};

// Sous-ensemble du DTO nécessaire à la validation croisée (découplé de la classe).
export interface DecisionContractInput {
  typeDecision: string;
  objetAType: string;
  objetAId: string;
  objetBType?: string | null;
  objetBId?: string | null;
  verdict?: string | null;
  payload?: Record<string, unknown> | null;
  supersedes?: string | null;
}

/**
 * Valide les contraintes CROISÉES propres à chaque type de décision. Lève une
 * BadRequestException (400) au premier écart, avec un message nommant le champ
 * fautif et le type concerné. À appeler après la validation class-validator du DTO
 * (qui garantit déjà : typeDecision dans l'enum, objetAId non vide, types dans OBJET_TYPES…).
 */
export function validateDecisionContract(dto: DecisionContractInput): void {
  const spec = CONTRACT[dto.typeDecision as DecisionType];
  // Filet de sécurité : le DTO (@IsIn) rejette déjà les types hors enum en amont.
  if (!spec) {
    throw new BadRequestException(
      `typeDecision "${dto.typeDecision}" hors du vocabulaire fermé (attendu : ${DECISION_TYPES.join(", ")})`,
    );
  }

  const forType = `pour le type "${dto.typeDecision}"`;

  // Objet A : toujours requis (objetAId garanti non vide par le DTO), type contraint.
  if (!spec.objetATypes.includes(dto.objetAType as ObjetType)) {
    throw new BadRequestException(
      `objetAType "${dto.objetAType}" invalide ${forType} (attendu : ${spec.objetATypes.join(", ")})`,
    );
  }

  // Objet B : requis (avec type/motif) ou interdit selon le type.
  const hasObjetB = dto.objetBType != null || dto.objetBId != null;
  if (spec.objetB.required) {
    if (dto.objetBType == null || dto.objetBId == null) {
      throw new BadRequestException(`objetBType et objetBId requis ${forType}`);
    }
    if (!spec.objetB.types.includes(dto.objetBType as ObjetBType)) {
      throw new BadRequestException(
        `objetBType "${dto.objetBType}" invalide ${forType} (attendu : ${spec.objetB.types.join(", ")})`,
      );
    }
    if (spec.objetB.idPattern && !spec.objetB.idPattern.test(dto.objetBId)) {
      throw new BadRequestException(`objetBId doit être ${spec.objetB.idPatternLabel} ${forType}`);
    }
  } else if (hasObjetB) {
    throw new BadRequestException(`objetBType/objetBId interdits ${forType}`);
  }

  // Révocation universelle : verdict='annule' est valide pour TOUS les types, à la
  // seule condition qu'une cible soit désignée. Il court-circuite les règles de verdict
  // ET de payload propres au type (une révocation n'affirme rien : ni verdict métier,
  // ni charge de correction). La compatibilité de la cible (même plateforme, même type)
  // est vérifiée côté service via `supersedes`.
  const isAnnule = dto.verdict === ANNULE_VERDICT;
  if (isAnnule) {
    if (dto.supersedes == null || dto.supersedes === "") {
      throw new BadRequestException(
        `verdict "${ANNULE_VERDICT}" exige supersedes (décision cible à révoquer) ${forType}`,
      );
    }
    return;
  }

  // Verdict : requis (valeur contrainte) ou interdit selon le type.
  if (spec.verdict.required) {
    if (dto.verdict == null) {
      throw new BadRequestException(`verdict requis ${forType} (attendu : ${spec.verdict.values.join(", ")})`);
    }
    if (!spec.verdict.values.includes(dto.verdict)) {
      throw new BadRequestException(
        `verdict "${dto.verdict}" invalide ${forType} (attendu : ${spec.verdict.values.join(", ")}, ou "${ANNULE_VERDICT}" avec supersedes)`,
      );
    }
  } else if (dto.verdict != null) {
    throw new BadRequestException(
      `verdict interdit ${forType} (sauf "${ANNULE_VERDICT}" avec supersedes pour révoquer)`,
    );
  }

  // Payload : forme imposée pour correction_signalee, libre sinon.
  if (spec.payload === "correction") {
    validateCorrectionPayload(dto.payload ?? null, forType);
  }
}

// correction_signalee exige un payload { champ, valeurProposee, source? }.
function validateCorrectionPayload(payload: Record<string, unknown> | null, forType: string): void {
  if (payload == null) {
    throw new BadRequestException(`payload requis ${forType} : { champ, valeurProposee, source? }`);
  }
  const { champ, valeurProposee, source } = payload as {
    champ?: unknown;
    valeurProposee?: unknown;
    source?: unknown;
  };
  if (typeof champ !== "string" || champ.trim() === "") {
    throw new BadRequestException(`payload.champ requis (chaîne non vide) ${forType}`);
  }
  if (typeof valeurProposee !== "string") {
    throw new BadRequestException(`payload.valeurProposee requis (chaîne) ${forType}`);
  }
  if (source !== undefined && typeof source !== "string") {
    throw new BadRequestException(`payload.source, s'il est fourni, doit être une chaîne ${forType}`);
  }
}
