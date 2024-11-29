import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const projectStatusEnum = pgEnum("project_status", [
  "DRAFT",
  "READY",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
]);

export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

export const communes = pgTable("communes", {
  id: uuid("id").primaryKey().defaultRandom(),
  inseeCode: text("insee_code").notNull().unique(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  nom: text("nom").notNull(),
  description: text("description").notNull(),
  porteur: text("porteur"),
  porteurCodeSiret: text("code_siret"),
  porteurReferentEmail: text("porteur_referent_email"),
  porteurReferentTelephone: text("porteur_referent_telephone"),
  porteurReferentPrenom: text("porteur_referent_prenom"),
  porteurReferentNom: text("porteur_referent_nom"),
  porteurReferentFonction: text("porteur_referent_fonction"),
  budget: integer("budget").notNull(),
  forecastedStartDate: text("forecasted_start_date").notNull(),
  status: projectStatusEnum().notNull(),
});

export const projectsToCommunes = pgTable("projects_to_communes", {
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  communeId: uuid("commune_id")
    .notNull()
    .references(() => communes.id),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("createdAt").defaultNow(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  logoUrl: text("logoUrl").notNull(),
  url: text("url").notNull(),
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  communes: many(projectsToCommunes),
}));

export const communesRelations = relations(communes, ({ many }) => ({
  projects: many(projectsToCommunes),
}));

export const projectsToCommunesRelations = relations(
  projectsToCommunes,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectsToCommunes.projectId],
      references: [projects.id],
    }),
    commune: one(communes, {
      fields: [projectsToCommunes.communeId],
      references: [communes.id],
    }),
  }),
);
