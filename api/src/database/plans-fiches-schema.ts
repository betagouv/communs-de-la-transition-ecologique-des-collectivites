import { index, integer, pgEnum, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

// ============================================================
// Schema: data_tc_plans — Plans & fiches action from TC opendata
// ============================================================

export const dataTcPlansSchema = pgSchema("data_tc_plans");

// Enum stays in public schema (pgSchema.enum() lacks proper typing in current Drizzle version)
const ficheActionStatuts = ["À venir", "En cours", "En retard", "En pause", "Bloqué", "Abandonné", "Terminé"] as const;
export const ficheActionStatutEnum = pgEnum("fiche_action_statut", ficheActionStatuts);
export type FicheActionStatut = (typeof ficheActionStatutEnum.enumValues)[number];

export const plansTransition = dataTcPlansSchema.table(
  "plans_transition",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    nom: text("nom").notNull(),
    type: text("type"),
    description: text("description"),
    periodeDebut: text("periode_debut"),
    periodeFin: text("periode_fin"),
    collectiviteResponsableSiren: text("collectivite_responsable_siren"),
    territoireCommunes: text("territoire_communes").array(),

    // TC source metadata
    tcDemarcheId: integer("tc_demarche_id").unique(),
    tcVersion: text("tc_version"),
    tcEtat: text("tc_etat"),
  },
  (t) => [index("plans_transition_siren_idx").on(t.collectiviteResponsableSiren)],
);

export const fichesAction = dataTcPlansSchema.table(
  "fiches_action",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    nom: text("nom").notNull(),
    description: text("description"),
    statut: ficheActionStatutEnum(),
    collectiviteResponsableSiren: text("collectivite_responsable_siren"),
    territoireCommunes: text("territoire_communes").array(),
    classificationThematiques: text("classification_thematiques").array(),

    // TC source metadata
    tcDemarcheId: integer("tc_demarche_id"),
    tcHash: text("tc_hash").unique(),
    tcSecteurs: text("tc_secteurs").array(),
    tcTypesPorteur: text("tc_types_porteur").array(),
    tcVolets: text("tc_volets").array(),
    tcTypeAction: text("tc_type_action"),
    tcCibleAction: text("tc_cible_action"),
  },
  (t) => [
    index("fiches_action_siren_idx").on(t.collectiviteResponsableSiren),
    index("fiches_action_tc_demarche_idx").on(t.tcDemarcheId),
  ],
);

export const fichesActionToPlansTransition = dataTcPlansSchema.table(
  "fiches_action_to_plans_transition",
  {
    ficheActionId: uuid("fiche_action_id")
      .notNull()
      .references(() => fichesAction.id),
    planTransitionId: uuid("plan_transition_id")
      .notNull()
      .references(() => plansTransition.id),
  },
  (t) => [
    primaryKey({ columns: [t.ficheActionId, t.planTransitionId] }),
    index("plan_fiche_idx").on(t.planTransitionId, t.ficheActionId),
  ],
);

// ============================================================
// Relations
// ============================================================

export const plansTransitionRelations = relations(plansTransition, ({ many }) => ({
  fichesAction: many(fichesActionToPlansTransition),
}));

export const fichesActionRelations = relations(fichesAction, ({ many }) => ({
  plansTransition: many(fichesActionToPlansTransition),
}));

export const fichesActionToPlansTransitionRelations = relations(fichesActionToPlansTransition, ({ one }) => ({
  ficheAction: one(fichesAction, {
    fields: [fichesActionToPlansTransition.ficheActionId],
    references: [fichesAction.id],
  }),
  planTransition: one(plansTransition, {
    fields: [fichesActionToPlansTransition.planTransitionId],
    references: [plansTransition.id],
  }),
}));
