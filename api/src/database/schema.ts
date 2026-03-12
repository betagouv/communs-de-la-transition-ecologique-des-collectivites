import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { eq, relations, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

const projetPhases = ["Idée", "Étude", "Opération"] as const;
export const projetPhasesEnum = pgEnum("projet_phases", projetPhases);
export type ProjetPhase = (typeof projetPhasesEnum.enumValues)[number];

const phaseStatut = ["En cours", "En retard", "En pause", "Bloqué", "Abandonné", "Terminé"] as const;
export const phaseStatutEnum = pgEnum("phase_statut", phaseStatut);
export type PhaseStatut = (typeof phaseStatutEnum.enumValues)[number];

export const collectiviteType = ["Commune", "EPCI"] as const;
export const collectiviteTypeEnum = pgEnum("collectivite_type", collectiviteType);
export type CollectiviteType = (typeof collectiviteTypeEnum.enumValues)[number];

export const projets = pgTable("projets", {
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
  budgetPrevisionnel: integer("budget_previsionnel"),
  dateDebutPrevisionnelle: text("date_debut_previsionnelle"),
  phase: projetPhasesEnum(),
  phaseStatut: phaseStatutEnum(),
  programme: text(),

  // porteur info
  porteurCodeSiret: text("code_siret"),
  porteurReferentEmail: text("porteur_referent_email"),
  porteurReferentTelephone: text("porteur_referent_telephone"),
  porteurReferentPrenom: text("porteur_referent_prenom"),
  porteurReferentNom: text("porteur_referent_nom"),
  porteurReferentFonction: text("porteur_referent_fonction"),

  //categorization
  competences: text("competences").array(),
  leviers: text("leviers").array(),

  // external service id
  mecId: text("mec_id").unique(),
  tetId: text("tet_id").unique(),
  recocoId: text("recoco_id").unique(),
  urbanVitalizId: text("urban_vitaliz_id").unique(),
  sosPontsId: text("sos_ponts_id").unique(),
  fondVertId: text("fond_vert_id").unique(),
});

export const collectivites = pgTable(
  "collectivites",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    nom: text("nom").notNull(),
    type: collectiviteTypeEnum("type").notNull(),

    // Codes officiels
    codeInsee: text("code_insee"),
    codeDepartements: text("code_departements").array(),
    codeRegions: text("code_regions").array(),
    codeEpci: text("code_epci"),
    siren: text("siren"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    //syntax as a workaround https://github.com/drizzle-team/drizzle-orm/issues/3349
    uniqueIndex()
      .on(t.codeEpci, t.type)
      .where(eq(t.type, sql`'EPCI'`)),
    uniqueIndex()
      .on(t.codeInsee, t.type)
      .where(eq(t.type, sql`'Commune'`)),
  ],
);

export const projetsToCollectivites = pgTable(
  "projets_to_collectivites",
  {
    projetId: uuid("projet_id")
      .notNull()
      .references(() => projets.id),
    collectiviteId: uuid("collectivite_id")
      .notNull()
      .references(() => collectivites.id),
  },
  (t) => [
    primaryKey({ columns: [t.projetId, t.collectiviteId] }),
    index("collectivite_projet_idx").on(t.collectiviteId, t.projetId),
  ],
);

// --- Plans de transition & Fiches action (schema v0.2.0) ---

const ficheActionStatuts = ["À venir", "En cours", "En retard", "En pause", "Bloqué", "Abandonné", "Terminé"] as const;
export const ficheActionStatutEnum = pgEnum("fiche_action_statut", ficheActionStatuts);
export type FicheActionStatut = (typeof ficheActionStatutEnum.enumValues)[number];

export const plansTransition = pgTable(
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

export const fichesAction = pgTable(
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

export const fichesActionToPlansTransition = pgTable(
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

export const services = pgTable("services", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  createdAt: timestamp("createdAt").defaultNow(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  sousTitre: text("sous_titre").notNull(),
  logoUrl: text("logo_url").notNull(),
  isListed: boolean("is_listed").notNull().default(false),
  redirectionUrl: text("redirection_url").notNull(),
  redirectionLabel: text("redirection_label"),
  iframeUrl: text("iframe_url"),
  extendLabel: text("extend_label"),
});

export const serviceContext = pgTable(
  "service_context",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    isListed: boolean("is_listed").notNull().default(false),
    // competences, leviers and phases can be NULL, to remove this field from the matching
    competences: text("competences").array().default([]),
    leviers: text("leviers").array().default([]),
    phases: projetPhasesEnum("phases").array().default([]),
    regions: text("regions").array().default([]),

    // Custom display options
    name: text("name"),
    description: text("description"),
    sousTitre: text("sous_titre"),
    logoUrl: text("logo_url"),
    redirectionUrl: text("redirection_url"),
    redirectionLabel: text("redirection_label"),
    extendLabel: text("extend_label"),
    iframeUrl: text("iframe_url"),
    extraFields: jsonb("extra_fields").$type<{ name: string; label: string }>().array().default([]),
  },
  (t) => [unique().on(t.id, t.description).nullsNotDistinct()],
);

export const serviceExtraFields = pgTable("service_extra_fields", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  projetId: uuid("projet_id")
    .notNull()
    .references(() => projets.id),
  name: text("name").notNull(),
  value: text("value").notNull(),
});

export const apiRequests = pgTable("api_requests", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // Request details
  method: text("method").notNull(),
  endpoint: text("endpoint").notNull(),
  fullUrl: text("full_url").notNull(),
  statusCode: integer("status_code").notNull(),
  responseTimeInMs: integer("response_time").notNull(),
  serviceName: text("service_name"),
});

// relations needed by drizzle to allow nested query : https://orm.drizzle.team/docs/relations
export const projetsRelations = relations(projets, ({ many }) => ({
  collectivites: many(projetsToCollectivites),
  extraFields: many(serviceExtraFields),
}));

export const collectivitesRelations = relations(collectivites, ({ many }) => ({
  projets: many(projetsToCollectivites),
}));

export const projetsToCollectivitesRelations = relations(projetsToCollectivites, ({ one }) => ({
  projet: one(projets, {
    fields: [projetsToCollectivites.projetId],
    references: [projets.id],
  }),
  collectivite: one(collectivites, {
    fields: [projetsToCollectivites.collectiviteId],
    references: [collectivites.id],
  }),
}));

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

export const servicesRelations = relations(services, ({ many }) => ({
  contexts: many(serviceContext),
}));

export const serviceContextRelations = relations(serviceContext, ({ one }) => ({
  service: one(services, {
    fields: [serviceContext.serviceId],
    references: [services.id],
  }),
}));

export const serviceExtraFieldsRelations = relations(serviceExtraFields, ({ one }) => ({
  projet: one(projets, {
    fields: [serviceExtraFields.projetId],
    references: [projets.id],
  }),
}));

// Re-export referentiel schema so DatabaseService picks up all tables
export * from "./referentiel-schema";
