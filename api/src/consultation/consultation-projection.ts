import { BadRequestException } from "@nestjs/common";
import {
  FinancementConsultationDto,
  LabelsConsultationDto,
  ProjetConsultationDto,
  ProvenanceReferenceDto,
} from "./dto/projet-consultation.dto";

// Only labels method served today. Always filtered on: other methods may cohabit in the view.
export const LABELS_METHODE = "jev-1.13/schema-riche-v1";

// One deduplicated project as returned by the page query (base columns kept in snake_case,
// `sources` and `financements` already aggregated as JSON by Postgres).
export interface ProjetRow {
  id: string;
  nom: string;
  description: string | null;
  budget_previsionnel: string | number | null;
  date_debut: string | null;
  date_fin: string | null;
  phase: string | null;
  phase_statut: string | null;
  collectivite_responsable_siren: string | null;
  porteur_operationnel_siret: string | null;
  porteur_nom: string | null;
  territoire_communes: string[] | null;
  territoire_departement: string | null;
  localisation_latitude: number | null;
  localisation_longitude: number | null;
  localisation_adresse: string | null;
  localisation_ban_id: string | null;
  plan_transition_ids: string[] | null;
  programmes_rattachement: string[] | null;
  ouverture: string;
  nb_lignes: number;
  sources: ProvenanceReferenceDto[] | null;
  financements: FinancementConsultationDto[] | null;
  labels_present: boolean;
  classification_thematiques: string[] | null;
  classification_sites: string[] | null;
  classification_interventions: string[] | null;
  leviers: string[] | null;
  competences_m57: string[] | null;
  nature: string | null;
  nature_confiance: number | null;
  te_global: number | null;
  te_attenuation: number | null;
  te_adaptation: number | null;
  te_biodiversite: number | null;
  bv_attenuation_cotation: string | null;
  bv_adaptation_cotation: string | null;
  bv_eau_cotation: string | null;
  bv_circulaire_cotation: string | null;
  bv_pollution_cotation: string | null;
  bv_biodiversite_cotation: string | null;
}

// Scores are stored as `real`: 0.93 comes back as 0.9300000071525574.
const score = (value: number | null): number | null => (value == null ? null : Math.round(value * 100) / 100);

const toLabels = (row: ProjetRow): LabelsConsultationDto | null => {
  if (!row.labels_present) return null;
  return {
    provisoire: true,
    methode: LABELS_METHODE,
    classificationThematiques: row.classification_thematiques ?? [],
    classificationSites: row.classification_sites ?? [],
    classificationInterventions: row.classification_interventions ?? [],
    leviersSgpe: row.leviers ?? [],
    competencesM57: row.competences_m57 ?? [],
    nature: row.nature,
    natureConfiance: score(row.nature_confiance),
    probabiliteTe: {
      global: score(row.te_global),
      attenuation: score(row.te_attenuation),
      adaptation: score(row.te_adaptation),
      biodiversite: score(row.te_biodiversite),
    },
    budgetVert: {
      attenuation: row.bv_attenuation_cotation,
      adaptation: row.bv_adaptation_cotation,
      eau: row.bv_eau_cotation,
      circulaire: row.bv_circulaire_cotation,
      pollution: row.bv_pollution_cotation,
      biodiversite: row.bv_biodiversite_cotation,
    },
  };
};

/**
 * Base row → exposed contract (common schema v0.2.0 in camelCase + labels block).
 * Derived at read time, never written. The internal uuid is deliberately dropped:
 * it is regenerated at each rebuild, the reference is the `provenances` block.
 */
export function toProjetConsultation(row: ProjetRow): ProjetConsultationDto {
  return {
    provenances: row.sources ?? [],
    nbLignesRegroupees: Number(row.nb_lignes),
    nom: row.nom,
    description: row.description,
    budgetPrevisionnel: row.budget_previsionnel == null ? null : Number(row.budget_previsionnel),
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    phase: row.phase,
    phaseStatut: row.phase_statut,
    collectiviteResponsableSiren: row.collectivite_responsable_siren,
    porteurOperationnelSiret: row.porteur_operationnel_siret,
    porteurNom: row.porteur_nom,
    territoireCommunes: row.territoire_communes ?? [],
    // Stored pipe-separated when a project spans several departments ("13|83|84").
    territoireDepartements: row.territoire_departement ? row.territoire_departement.split("|") : [],
    localisationLatitude: row.localisation_latitude,
    localisationLongitude: row.localisation_longitude,
    localisationAdresse: row.localisation_adresse,
    localisationBanId: row.localisation_ban_id,
    planTransitionIds: row.plan_transition_ids ?? [],
    programmesRattachement: row.programmes_rattachement ?? [],
    ouverture: row.ouverture,
    labels: toLabels(row),
    financements: row.financements ?? [],
  };
}

// Position of the last project served: SIREN (null among the projects without one) and
// internal id of its first line. The id only anchors a pagination run, it is never a
// durable key, hence the opaque token.
export interface CursorPosition {
  siren: string | null;
  id: string;
}

export const SIREN_REGEX = /^\d{9}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify({ s: position.siren, i: position.id })).toString("base64url");
}

export function decodeCursor(token: string): CursorPosition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    throw new BadRequestException("cursor invalide");
  }
  const { s, i } = (parsed ?? {}) as { s?: unknown; i?: unknown };
  const sirenOk = s === null || (typeof s === "string" && SIREN_REGEX.test(s));
  if (!sirenOk || typeof i !== "string" || !UUID_REGEX.test(i)) {
    throw new BadRequestException("cursor invalide");
  }
  return { siren: s, id: i };
}

const MILLESIME_MIN = 1900;
const MILLESIME_MAX = 2100;

export function parseMillesime(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const year = /^\d{4}$/.test(value) ? Number(value) : NaN;
  if (!(year >= MILLESIME_MIN && year <= MILLESIME_MAX)) {
    throw new BadRequestException("millesime invalide (attendu : une année sur 4 chiffres)");
  }
  return year;
}
