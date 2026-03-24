import { index, integer, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

// ============================================================
// Schema: data_tet — Plans & fiches action from TeT webhooks
// Implements schema v0.2 (plans-transition, fiches-action)
// ============================================================

export const dataTetSchema = pgSchema("data_tet");

// Plans de transition (PCAET, CRTE, PAT...)
export const tetPlansTransition = dataTetSchema.table(
  "plans_transition",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    tetId: text("tet_id").unique().notNull(),
    nom: text("nom"),
    type: text("type"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("tet_plans_tet_id_idx").on(t.tetId)],
);

// Fiches action (intentions politiques)
export const tetFichesAction = dataTetSchema.table(
  "fiches_action",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    tetId: text("tet_id").unique().notNull(),
    nom: text("nom").notNull(),
    description: text("description"),
    statut: text("statut"),
    budgetPrevisionnel: integer("budget_previsionnel"),
    dateDebutPrevisionnelle: text("date_debut_previsionnelle"),

    // Parent relationship (sous-action → action)
    parentTetId: text("parent_tet_id"),

    // Porteur
    porteurReferentNom: text("porteur_referent_nom"),
    porteurReferentEmail: text("porteur_referent_email"),
    porteurReferentTelephone: text("porteur_referent_telephone"),

    // Collectivité
    collectiviteType: text("collectivite_type"),
    collectiviteCode: text("collectivite_code"),

    // Classification v0.2 (auto-populated via LLM)
    classificationThematiques: text("classification_thematiques").array(),
    classificationSites: text("classification_sites").array(),
    classificationInterventions: text("classification_interventions").array(),
    probabiliteTE: text("probabilite_te"),
    classificationScores: jsonb("classification_scores").$type<{
      thematiques: { label: string; score: number }[];
      sites: { label: string; score: number }[];
      interventions: { label: string; score: number }[];
    }>(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("tet_fiches_tet_id_idx").on(t.tetId), index("tet_fiches_parent_idx").on(t.parentTetId)],
);

// N:N relation fiches_action <-> plans_transition
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
