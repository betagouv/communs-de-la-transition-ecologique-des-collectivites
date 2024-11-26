import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";

//todo still in discussion
export const projectStatusEnum = pgEnum("project_status", [
  "DRAFT",
  "READY",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
]);

export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  nom: text("nom").notNull(),
  description: text("description").notNull(),
  codeSiret: text("code_siret").notNull(),
  porteurEmailHash: text("porteur_email_hash").notNull(),
  communeInseeCodes: text("commune_insee_codes").array().notNull(),
  budget: integer("budget").notNull(),
  forecastedStartDate: text("forecasted_start_date").notNull(),
  status: projectStatusEnum().notNull(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("createdAt").defaultNow(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  logoUrl: text("logoUrl").notNull(),
  url: text("url").notNull(),
});
