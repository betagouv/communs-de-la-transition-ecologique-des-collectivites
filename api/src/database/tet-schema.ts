import { index, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

// ============================================================
// Schema: data_tet — Plans & fiches action from TeT webhooks
// Aligned with schema v0.2.0 (plans-transition, fiches-action)
// https://api-collectivites-roadmap.pages.dev/schema-commun-v0.2.0
// ============================================================

export const dataTetSchema = pgSchema("data_tet");

// --- External IDs ---
// Generic junction table for platform-specific identifiers.
// Replaces hardcoded mecId/tetId columns per the v0.2 FAQ recommendation:
// "Le mapping sera géré par l'API Collectivités dans une table de jonction
//  external_ids(objetId, serviceType, externalId)"
export const tetExternalIds = dataTetSchema.table(
  "external_ids",
  {
    objetId: uuid("objet_id").notNull(),
    serviceType: text("service_type").notNull(), // e.g. "TeT", "MEC", "FondsVert"
    externalId: text("external_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.objetId, t.serviceType] }),
    index("tet_external_ids_external_idx").on(t.serviceType, t.externalId),
  ],
);

// --- Plans de transition (8 champs schéma v0.2) ---
export const tetPlansTransition = dataTetSchema.table(
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
  (t) => [index("tet_plans_siren_idx").on(t.collectiviteResponsableSiren)],
);

// --- Fiches action (11 champs schéma v0.2 + classification + parent) ---
export const tetFichesAction = dataTetSchema.table(
  "fiches_action",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    // Schema v0.2 fields
    nom: text("nom").notNull(),
    description: text("description"),
    objectifs: text("objectifs"),
    statut: text("statut"),
    competencesM57: text("competences_m57").array(),
    leviersSgpe: text("leviers_sgpe").array(),
    collectiviteResponsableSiren: text("collectivite_responsable_siren"),
    territoireCommunes: text("territoire_communes").array(),
    classificationThematiques: text("classification_thematiques").array(),

    // Parent relationship (sous-action → action, not in v0.2 but needed for TeT hierarchy)
    parentId: uuid("parent_id"),

    // Classification extended (auto-populated via LLM, beyond v0.2)
    classificationSites: text("classification_sites").array(),
    classificationInterventions: text("classification_interventions").array(),
    probabiliteTE: text("probabilite_te"),
    classificationScores: jsonb("classification_scores").$type<{
      thematiques: { label: string; score: number }[];
      sites: { label: string; score: number }[];
      interventions: { label: string; score: number }[];
    }>(),

    // Lifecycle
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("tet_fiches_siren_idx").on(t.collectiviteResponsableSiren),
    index("tet_fiches_parent_idx").on(t.parentId),
  ],
);

// --- N:N fiches_action <-> plans_transition ---
export const tetFichesActionToPlans = dataTetSchema.table(
  "fiches_action_to_plans",
  {
    ficheActionId: uuid("fiche_action_id")
      .notNull()
      .references(() => tetFichesAction.id),
    planTransitionId: uuid("plan_transition_id")
      .notNull()
      .references(() => tetPlansTransition.id),
  },
  (t) => [primaryKey({ columns: [t.ficheActionId, t.planTransitionId] })],
);

// ============================================================
// Relations
// ============================================================

export const tetPlansTransitionRelations = relations(tetPlansTransition, ({ many }) => ({
  fichesAction: many(tetFichesActionToPlans),
}));

export const tetFichesActionRelations = relations(tetFichesAction, ({ many }) => ({
  plans: many(tetFichesActionToPlans),
}));

export const tetFichesActionToPlansRelations = relations(tetFichesActionToPlans, ({ one }) => ({
  ficheAction: one(tetFichesAction, {
    fields: [tetFichesActionToPlans.ficheActionId],
    references: [tetFichesAction.id],
  }),
  planTransition: one(tetPlansTransition, {
    fields: [tetFichesActionToPlans.planTransitionId],
    references: [tetPlansTransition.id],
  }),
}));
