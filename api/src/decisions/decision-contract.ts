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
export const OBJET_B_TYPES = [...OBJET_TYPES, "pcaet"] as const;
export type ObjetBType = (typeof OBJET_B_TYPES)[number];

// Vocabulaire fermé des types de décision.
export const DECISION_TYPES = [
  "doublon_signale",
  "doublon_confirme",
  "doublon_infirme",
  "rattachement_pcaet",
  "projet_statut",
  "correction_signalee",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

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

  // Verdict : requis (valeur contrainte) ou interdit selon le type.
  if (spec.verdict.required) {
    if (dto.verdict == null) {
      throw new BadRequestException(`verdict requis ${forType} (attendu : ${spec.verdict.values.join(", ")})`);
    }
    if (!spec.verdict.values.includes(dto.verdict)) {
      throw new BadRequestException(
        `verdict "${dto.verdict}" invalide ${forType} (attendu : ${spec.verdict.values.join(", ")})`,
      );
    }
  } else if (dto.verdict != null) {
    throw new BadRequestException(`verdict interdit ${forType}`);
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
