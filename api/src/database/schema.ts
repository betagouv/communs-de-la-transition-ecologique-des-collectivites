import { pgTable, text, timestamp, integer, date } from "drizzle-orm/pg-core";

//todo still in discussion
export const ProjectStatus = {
  DRAFT: "DRAFT",
  READY: "READY",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const;

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  nom: text("nom").notNull(),
  description: text("description").notNull(),
  codeSiret: text("code_siret").notNull(),
  porteurEmailHash: text("porteur_email_hash").notNull(),
  communeInseeCodes: text("commune_insee_codes").array().notNull(),
  budget: integer("budget").notNull(),
  forecastedStartDate: date("forecasted_start_date").notNull(),
  status: text("status").notNull().$type<keyof typeof ProjectStatus>(),
});

export const services = pgTable("services", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("createdAt").defaultNow(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  logoUrl: text("logoUrl").notNull(),
  url: text("url").notNull(),
});
