import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

// ============================================================
// Schema: data_mec — Projets opérationnels from MEC ingestion
// Aligned with schema v0.2.0 (projets-operationnels)
// https://api-collectivites-roadmap.pages.dev/schema-commun-v0.2.0
// ============================================================

export const dataMecSchema = pgSchema("data_mec");

// --- External IDs ---
// Generic junction table for platform-specific identifiers.
export const mecExternalIds = dataMecSchema.table(
  "external_ids",
  {
    objetId: uuid("objet_id").notNull(),
    serviceType: text("service_type").notNull(), // e.g. "MEC", "TeT", "FondsVert"
    externalId: text("external_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.objetId, t.serviceType] }),
    index("mec_external_ids_external_idx").on(t.serviceType, t.externalId),
  ],
);

// --- Plans de transition (schema v0.2 fields) ---
export const mecPlansTransition = dataMecSchema.table(
  "plans_transition",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    // Schema v0.2 fields
    nom: text("nom"),
    type: text("type"),
    description: text("description"),
    periodeDebut: text("periode_debut"),
    periodeFin: text("periode_fin"),
    collectiviteResponsableSiren: text("collectivite_responsable_siren"),
    territoireCommunes: text("territoire_communes").array(),

    // Lifecycle
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("mec_plans_siren_idx").on(t.collectiviteResponsableSiren)],
);

// --- Projets opérationnels (schema v0.2 + classification + CRTE + MEC-specific) ---
export const mecProjetsOperationnels = dataMecSchema.table(
  "projets_operationnels",
  {
    // ID preserved from public.projets — NO auto-generation
    id: uuid("id").primaryKey(),

    // Schema v0.2 fields
    nom: text("nom").notNull(),
    description: text("description"),
    budgetPrevisionnel: integer("budget_previsionnel"),
    dateDebut: text("date_debut"),
    dateFin: text("date_fin"),
    phase: text("phase"),
    phaseStatut: text("phase_statut"),
    collectiviteResponsableSiren: text("collectivite_responsable_siren"),
    porteurOperationnelSiret: text("porteur_operationnel_siret"),
    territoireCommunes: text("territoire_communes").array(),
    competencesM57: text("competences_m57").array(),
    leviersSgpe: text("leviers_sgpe").array(),
    programmesRattachement: text("programmes_rattachement").array(),
    localisationLatitude: doublePrecision("localisation_latitude"),
    localisationLongitude: doublePrecision("localisation_longitude"),
    localisationAdresse: text("localisation_adresse"),
    localisationBanId: text("localisation_ban_id"),

    // Classification v0.2 (auto-populated via LLM)
    classificationThematiques: text("classification_thematiques").array(),
    classificationSites: text("classification_sites").array(),
    classificationInterventions: text("classification_interventions").array(),

    // Classification LLM scores
    classificationScores: jsonb("classification_scores").$type<{
      thematiques: { label: string; score: number }[];
      sites: { label: string; score: number }[];
      interventions: { label: string; score: number }[];
    }>(),
    probabiliteTe: doublePrecision("probabilite_te"),

    // CRTE first-class fields
    crteId: text("crte_id"),
    crteAnneeInscription: integer("crte_annee_inscription"),
    crteOrientationStrategique: text("crte_orientation_strategique"),

    // MEC-specific fields
    sourceMec: text("source_mec"),
    pcaetOperationInscrite: boolean("pcaet_operation_inscrite"),
    fnvThematiques: text("fnv_thematiques"),
    motsCles: text("mots_cles"),
    besoins: text("besoins"),
    planRattachement: text("plan_rattachement"),
    sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown>>(),

    // Lifecycle
    contentHash: text("content_hash"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("mec_projets_siren_idx").on(t.collectiviteResponsableSiren),
    index("mec_projets_crte_idx").on(t.crteId),
    index("mec_projets_source_mec_idx").on(t.sourceMec),
  ],
);

// --- N:N projets_operationnels <-> plans_transition ---
export const mecProjetsToPlans = dataMecSchema.table(
  "projets_to_plans",
  {
    projetId: uuid("projet_id")
      .notNull()
      .references(() => mecProjetsOperationnels.id),
    planTransitionId: uuid("plan_transition_id")
      .notNull()
      .references(() => mecPlansTransition.id),
  },
  (t) => [primaryKey({ columns: [t.projetId, t.planTransitionId] })],
);

// ============================================================
// Relations
// ============================================================

export const mecPlansTransitionRelations = relations(mecPlansTransition, ({ many }) => ({
  projets: many(mecProjetsToPlans),
}));

export const mecProjetsOperationnelsRelations = relations(mecProjetsOperationnels, ({ many }) => ({
  plans: many(mecProjetsToPlans),
}));

export const mecProjetsToPlansRelations = relations(mecProjetsToPlans, ({ one }) => ({
  projet: one(mecProjetsOperationnels, {
    fields: [mecProjetsToPlans.projetId],
    references: [mecProjetsOperationnels.id],
  }),
  planTransition: one(mecPlansTransition, {
    fields: [mecProjetsToPlans.planTransitionId],
    references: [mecPlansTransition.id],
  }),
}));
