import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  uuid,
  primaryKey,
  index,
  boolean,
  jsonb,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { eq, relations, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

const projectStatus = ["IDEE", "FAISABILITE", "EN_COURS", "IMPACTE", "ABANDONNE", "TERMINE"] as const;
export const projectStatusEnum = pgEnum("project_status", projectStatus);
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

const collectiviteType = ["Commune", "EPCI"] as const;
export const collectiviteTypeEnum = pgEnum("collectivite_type", collectiviteType);
export type CollectiviteType = (typeof collectiviteTypeEnum.enumValues)[number];

export const projects = pgTable("projects", {
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
  budget: integer("budget"),
  forecastedStartDate: text("forecasted_start_date"),
  status: projectStatusEnum(),

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
    siren: text("siren").unique(),

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

export const projectsToCollectivites = pgTable(
  "projects_to_collectivites",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    collectiviteId: uuid("collectivite_id")
      .notNull()
      .references(() => collectivites.id),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.collectiviteId] }),
    index("collectivite_project_idx").on(t.collectiviteId, t.projectId),
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
  isListed: boolean("is_listed").default(false),
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
    competences: text("competences").array().notNull().default([]),
    leviers: text("leviers").array(),
    status: projectStatusEnum("status").array().notNull().default([]),

    // Custom display options
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
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  value: text("value").notNull(),
});

// relations needed by drizzle to allow nested query : https://orm.drizzle.team/docs/relations
export const projectsRelations = relations(projects, ({ many }) => ({
  collectivites: many(projectsToCollectivites),
  extraFields: many(serviceExtraFields),
}));

export const collectivitesRelations = relations(collectivites, ({ many }) => ({
  projects: many(projectsToCollectivites),
}));

export const projectsToCollectivitesRelations = relations(projectsToCollectivites, ({ one }) => ({
  project: one(projects, {
    fields: [projectsToCollectivites.projectId],
    references: [projects.id],
  }),
  collectivite: one(collectivites, {
    fields: [projectsToCollectivites.collectiviteId],
    references: [collectivites.id],
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
  project: one(projects, {
    fields: [serviceExtraFields.projectId],
    references: [projects.id],
  }),
}));
