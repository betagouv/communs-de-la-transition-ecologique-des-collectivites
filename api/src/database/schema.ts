import { pgTable, text, timestamp, integer, pgEnum, uuid, primaryKey, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { competences, sousCompetences } from "@/shared/const/competences-list";

export const projectStatusEnum = pgEnum("project_status", [
  "IDEE",
  "FAISABILITE",
  "EN_COURS",
  "IMPACTE",
  "ABANDONNE",
  "TERMINE",
]);

export const competencesEnum = pgEnum("competences", competences);
export const sousCompetencesEnum = pgEnum("sous_competences", sousCompetences);

export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

export const permissionTypeEnum = pgEnum("permission_type", ["EDIT", "VIEW"]);

export type PermissionType = (typeof permissionTypeEnum.enumValues)[number];

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
    .$defaultFn(() => uuidv7()),
  createdAt: timestamp("createdAt").defaultNow(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  logoUrl: text("logoUrl").notNull(),
  url: text("url").notNull(),
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
