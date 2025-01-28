import { pgTable, text, timestamp, integer, pgEnum, uuid, primaryKey, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { competences, sousCompetences } from "@/shared/const/competences-list";

const projectStatus = ["IDEE", "FAISABILITE", "EN_COURS", "IMPACTE", "ABANDONNE", "TERMINE"] as const;

export const projectStatusEnum = pgEnum("project_status", projectStatus);
export const competencesEnum = pgEnum("competences", competences);
export const sousCompetencesEnum = pgEnum("sous_competences", sousCompetences);

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
  porteurCodeSiret: text("code_siret"),
  porteurReferentEmail: text("porteur_referent_email"),
  porteurReferentTelephone: text("porteur_referent_telephone"),
  porteurReferentPrenom: text("porteur_referent_prenom"),
  porteurReferentNom: text("porteur_referent_nom"),
  porteurReferentFonction: text("porteur_referent_fonction"),
  competences: competencesEnum().array(),
  sousCompetences: sousCompetencesEnum("sous_competences").array(),
  budget: integer("budget"),
  forecastedStartDate: text("forecasted_start_date"),
  status: projectStatusEnum(),
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
    .$defaultFn(() => uuidv7()), //todo should this really be a uuid ? there will be a list of finite services
  createdAt: timestamp("createdAt").defaultNow(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  logoUrl: text("logo_url").notNull(),
  iframeUrl: text("iframe_url"),
  redirectionUrl: text("redirection_url").notNull(),
  redirectionLabel: text("redirection_label").notNull(),
  extendLabel: text("extend_label"),
});

export const serviceContext = pgTable("service_context", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id),
  competences: competencesEnum("competences").array().notNull().default([]),
  sousCompetences: sousCompetencesEnum("sous_competences").array().notNull().default([]),
  statuses: projectStatusEnum("statuses").array().notNull().default([]),

  // Custom display options
  description: text("description"),
  logoUrl: text("logo_url"),
  redirectionUrl: text("redirection_url"),
  redirectionLabel: text("redirection_label"),
  extendLabel: text("extend_label"),
  iframeUrl: text("iframe_url"),
});

// relations needed by drizzle to allow nested query : https://orm.drizzle.team/docs/relations
export const projectsRelations = relations(projects, ({ many }) => ({
  communes: many(projectsToCommunes),
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
