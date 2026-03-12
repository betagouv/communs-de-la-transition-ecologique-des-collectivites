import { index, integer, pgSchema, primaryKey, text, varchar, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// Schema: api_referentiel — Reference data (Banatic, COG, etc.)
// ============================================================

export const apiReferentielSchema = pgSchema("api_referentiel");

// ============================================================
// Tables
// ============================================================

export const refCommunes = apiReferentielSchema.table(
  "communes",
  {
    codeInsee: varchar("code_insee", { length: 5 }).primaryKey(),
    siren: varchar("siren", { length: 9 }).notNull().unique(),
    siret: varchar("siret", { length: 14 }),
    nom: text("nom").notNull(),
    population: integer("population"),
    codesPostaux: text("codes_postaux").array(),
    codeDepartement: varchar("code_departement", { length: 3 }),
    codeRegion: varchar("code_region", { length: 3 }),
    codeEpci: varchar("code_epci", { length: 9 }),
  },
  (t) => [
    index("ref_communes_siren_idx").on(t.siren),
    index("ref_communes_departement_idx").on(t.codeDepartement),
    index("ref_communes_epci_idx").on(t.codeEpci),
  ],
);

export const refGroupements = apiReferentielSchema.table(
  "groupements",
  {
    siren: varchar("siren", { length: 9 }).primaryKey(),
    siret: varchar("siret", { length: 14 }),
    nom: text("nom").notNull(),
    type: varchar("type", { length: 10 }).notNull(),
    population: integer("population"),
    nbCommunes: integer("nb_communes"),
    departements: text("departements").array(),
    regions: text("regions").array(),
    modeFinancement: text("mode_financement"),
    dateCreation: date("date_creation"),
  },
  (t) => [index("ref_groupements_type_idx").on(t.type)],
);

export const refPerimetres = apiReferentielSchema.table(
  "perimetres",
  {
    sirenGroupement: varchar("siren_groupement", { length: 9 })
      .notNull()
      .references(() => refGroupements.siren),
    codeInseeCommune: varchar("code_insee_commune", { length: 5 })
      .notNull()
      .references(() => refCommunes.codeInsee),
    categorieMembre: varchar("categorie_membre", { length: 20 }),
  },
  (t) => [
    primaryKey({ columns: [t.sirenGroupement, t.codeInseeCommune] }),
    index("ref_perimetres_commune_idx").on(t.codeInseeCommune),
  ],
);

export const refCompetenceCategories = apiReferentielSchema.table("competence_categories", {
  code: varchar("code", { length: 10 }).primaryKey(),
  nom: text("nom").notNull(),
});

export const refCompetences = apiReferentielSchema.table("competences", {
  code: varchar("code", { length: 10 }).primaryKey(),
  nom: text("nom").notNull(),
  codeCategorie: varchar("code_categorie", { length: 10 })
    .notNull()
    .references(() => refCompetenceCategories.code),
});

export const refGroupementCompetences = apiReferentielSchema.table(
  "groupement_competences",
  {
    sirenGroupement: varchar("siren_groupement", { length: 9 })
      .notNull()
      .references(() => refGroupements.siren),
    codeCompetence: varchar("code_competence", { length: 10 })
      .notNull()
      .references(() => refCompetences.code),
  },
  (t) => [
    primaryKey({ columns: [t.sirenGroupement, t.codeCompetence] }),
    index("ref_grp_comp_competence_idx").on(t.codeCompetence),
  ],
);

// ============================================================
// Relations
// ============================================================

export const refCommunesRelations = relations(refCommunes, ({ many }) => ({
  perimetres: many(refPerimetres),
}));

export const refGroupementsRelations = relations(refGroupements, ({ many }) => ({
  perimetres: many(refPerimetres),
  competences: many(refGroupementCompetences),
}));

export const refPerimetresRelations = relations(refPerimetres, ({ one }) => ({
  groupement: one(refGroupements, {
    fields: [refPerimetres.sirenGroupement],
    references: [refGroupements.siren],
  }),
  commune: one(refCommunes, {
    fields: [refPerimetres.codeInseeCommune],
    references: [refCommunes.codeInsee],
  }),
}));

export const refCompetencesRelations = relations(refCompetences, ({ one, many }) => ({
  categorie: one(refCompetenceCategories, {
    fields: [refCompetences.codeCategorie],
    references: [refCompetenceCategories.code],
  }),
  groupements: many(refGroupementCompetences),
}));

export const refCompetenceCategoriesRelations = relations(refCompetenceCategories, ({ many }) => ({
  competences: many(refCompetences),
}));

export const refGroupementCompetencesRelations = relations(refGroupementCompetences, ({ one }) => ({
  groupement: one(refGroupements, {
    fields: [refGroupementCompetences.sirenGroupement],
    references: [refGroupements.siren],
  }),
  competence: one(refCompetences, {
    fields: [refGroupementCompetences.codeCompetence],
    references: [refCompetences.code],
  }),
}));
