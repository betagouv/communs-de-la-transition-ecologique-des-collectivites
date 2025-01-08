import { pgTable, text, timestamp, integer, pgEnum, uuid, primaryKey, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const projectStatusEnum = pgEnum("project_status", [
  "IDEE",
  "FAISABILITE",
  "EN_COURS",
  "IMPACTE",
  "ABANDONNE",
  "TERMINE",
]);

export const competencesEnum = pgEnum("competences", [
  "Action sociale (hors APA et RSA)",
  "Actions en matière de gestion des eaux",
  "Agriculture, pêche et agro-alimentaire",
  "Aménagement des territoires",
  "Autres interventions de protection civile",
  "Autres services annexes de l'enseignement",
  "Collecte et traitement des déchets",
  "Culture",
  "Développement touristique",
  "Enseignement du premier degré",
  "Enseignement du second degré",
  "Enseignement supérieur, professionnel et continu",
  "Foires et marchés",
  "Habitat",
  "Hébergement et restauration scolaires",
  "Hygiène et salubrité publique",
  "Incendie et secours",
  "Industrie, commerce et artisanat",
  "Infrastructures de transport",
  "Jeunesse et loisirs",
  "Police, sécurité, justice",
  "Propreté urbaine",
  "Routes et voiries",
  "Santé",
  "Sports",
  "Transports publics (hors scolaire)",
  "Transports scolaires",
]);

export const sousCompetencesEnum = pgEnum("sous_competences", [
  "Accessibilité",
  "Architecture",
  "Artisanat",
  "Arts plastiques et photographie",
  "Assainissement des eaux",
  "Bâtiments et construction",
  "Bibliothèques et livres",
  "Cimetières et funéraire",
  "Citoyenneté",
  "Cohésion sociale et inclusion",
  "Commerces et Services",
  "Consommation alimentaire",
  "Cours d'eau / canaux / plans d'eau",
  "Déchets alimentaires et/ou agricoles",
  "Distribution",
  "Eau pluviale",
  "Eau potable",
  "Eau souterraine",
  "Economie locale et circuits courts",
  "Economie sociale et solidaire",
  "Egalité des chances",
  "Equipement public",
  "Espace public",
  "Espaces verts",
  "Famille et enfance",
  "Fiscalité des entreprises",
  "Foncier",
  "Friche",
  "Handicap",
  "Inclusion numérique",
  "Industrie",
  "Innovation, créativité et recherche",
  "Jeunesse",
  "Logement et habitat",
  "Lutte contre la précarité",
  "Médias et communication",
  "Mers et océans",
  "Musée",
  "Patrimoine et monuments historiques",
  "Paysage",
  "Personnes âgées",
  "Précarité et aide alimentaire",
  "Production agricole et foncier",
  "Protection animale",
  "Réseaux",
  "Spectacle vivant",
  "Technologies numériques et numérisation",
  "Tiers-lieux",
  "Transformation des produits agricoles",
]);

export type Competences = (typeof competencesEnum.enumValues)[number];
export type SousCompetences = (typeof sousCompetencesEnum.enumValues)[number];
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

export const communes = pgTable("communes", {
  inseeCode: text("insee_code").primaryKey(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  nom: text("nom").notNull(),
  description: text("description").notNull(),
  porteurCodeSiret: text("code_siret"),
  porteurReferentEmail: text("porteur_referent_email"),
  porteurReferentTelephone: text("porteur_referent_telephone"),
  porteurReferentPrenom: text("porteur_referent_prenom"),
  porteurReferentNom: text("porteur_referent_nom"),
  porteurReferentFonction: text("porteur_referent_fonction"),
  competences: competencesEnum(),
  sousCompetences: sousCompetencesEnum("sous_competences"),
  budget: integer("budget").notNull(),
  forecastedStartDate: text("forecasted_start_date").notNull(),
  status: projectStatusEnum().notNull(),
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
  id: uuid("id").primaryKey().defaultRandom(),
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
