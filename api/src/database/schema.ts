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

export const porteurReferents = pgTable("porteur_referents", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  telephone: text("telephone"),
  prenom: text("prenom"),
  nom: text("nom"),
});

// export const communes = pgTable("communes", {
//   id: uuid("id").primaryKey().defaultRandom(),
//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at").defaultNow(),
//   inseeCode: text("insee_code").notNull().unique(),
// });

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  nom: text("nom").notNull(),
  description: text("description").notNull(),
  codeSiret: text("code_siret").notNull(),
  porteurReferentId: uuid("porteur_referent_id").references(
    () => porteurReferents.id,
  ),
  communeInseeCodes: text("commune_insee_codes").array().notNull(),
  budget: integer("budget").notNull(),
  forecastedStartDate: text("forecasted_start_date").notNull(),
  status: projectStatusEnum().notNull(),
});

// export const projectsToCommunes = pgTable("projects_to_communes", {
//   projectId: uuid("project_id")
//     .notNull()
//     .references(() => projects.id),
//   communeId: uuid("commune_id")
//     .notNull()
//     .references(() => communes.id),
// });

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("createdAt").defaultNow(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  logoUrl: text("logoUrl").notNull(),
  url: text("url").notNull(),
});

export const projectsRelations = relations(projects, ({ one }) => ({
  porteurReferent: one(porteurReferents, {
    fields: [projects.porteurReferentId],
    references: [porteurReferents.id],
  }),
  // communes: many(projectsToCommunes),
}));

// export const communesRelations = relations(communes, ({ many }) => ({
//   projects: many(projectsToCommunes),
// }));

export const porteurReferentsRelations = relations(
  porteurReferents,
  ({ many }) => ({
    projects: many(projects),
  }),
);

// export const projectsToCommunesRelations = relations(
//   projectsToCommunes,
//   ({ one }) => ({
//     project: one(projects, {
//       fields: [projectsToCommunes.projectId],
//       references: [projects.id],
//     }),
//     commune: one(communes, {
//       fields: [projectsToCommunes.communeId],
//       references: [communes.id],
//     }),
//   }),
// );
