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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

const projectStatus = ["IDEE", "FAISABILITE", "EN_COURS", "IMPACTE", "ABANDONNE", "TERMINE"] as const;
export const projectStatusEnum = pgEnum("project_status", projectStatus);
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

export const communes = pgTable("communes", {
  inseeCode: text("insee_code").primaryKey(),
});

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

export const projectsToCommunes = pgTable(
  "projects_to_communes",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    communeId: text("commune_id")
      .notNull()
      .references(() => communes.inseeCode),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.communeId] }),
    index("commune_project_idx").on(t.communeId, t.projectId),
  ],
);

export const services = pgTable("services", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  createdAt: timestamp("createdAt").defaultNow(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  sousTitre: text("sous_titre").notNull(),
  logoUrl: text("logo_url").notNull(),
  isListed: boolean("is_listed").default(false),
  redirectionUrl: text("redirection_url").notNull(),
  redirectionLabel: text("redirection_label"),
  iframeUrl: text("iframe_url"),
  extendLabel: text("extend_label"),
});

export const serviceContext = pgTable("service_context", {
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
});

export const serviceExtraFields = pgTable("service_extra_fields", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("field_name").notNull(),
  value: text("field_value").notNull(),
});

// relations needed by drizzle to allow nested query : https://orm.drizzle.team/docs/relations
export const projectsRelations = relations(projects, ({ many }) => ({
  communes: many(projectsToCommunes),
  extraFields: many(serviceExtraFields),
}));

export const communesRelations = relations(communes, ({ many }) => ({
  projects: many(projectsToCommunes),
}));

export const projectsToCommunesRelations = relations(projectsToCommunes, ({ one }) => ({
  project: one(projects, {
    fields: [projectsToCommunes.projectId],
    references: [projects.id],
  }),
  commune: one(communes, {
    fields: [projectsToCommunes.communeId],
    references: [communes.inseeCode],
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
