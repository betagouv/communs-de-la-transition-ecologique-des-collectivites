import {
  refCommunes,
  refGroupements,
  refPerimetres,
  refCompetenceCategories,
  refCompetences,
  refGroupementCompetences,
} from "@database/schema";
import type { DatabaseService } from "@database/database.service";

// ============================================================
// Factory helpers for referentiel test fixtures
// ============================================================

export function makeCommune(overrides: Partial<typeof refCommunes.$inferInsert> = {}) {
  return {
    codeInsee: "01001",
    siren: "210100012",
    siret: null,
    nom: "L'Abergement-Clémenciat",
    population: 800,
    codesPostaux: ["01400"],
    codeDepartement: "01",
    codeRegion: "84",
    codeEpci: "200069193",
    ...overrides,
  } satisfies typeof refCommunes.$inferInsert;
}

export function makeGroupement(overrides: Partial<typeof refGroupements.$inferInsert> = {}) {
  return {
    siren: "200069193",
    siret: null,
    nom: "CC de la Dombes",
    type: "CC",
    population: 45000,
    nbCommunes: 25,
    departements: ["01"],
    regions: ["84"],
    modeFinancement: "FPU",
    dateCreation: "2017-01-01",
    ...overrides,
  } satisfies typeof refGroupements.$inferInsert;
}

export function makePerimetre(overrides: Partial<typeof refPerimetres.$inferInsert> = {}) {
  return {
    sirenGroupement: "200069193",
    codeInseeCommune: "01001",
    categorieMembre: null,
    ...overrides,
  } satisfies typeof refPerimetres.$inferInsert;
}

export function makeCompetenceCategorie(overrides: Partial<typeof refCompetenceCategories.$inferInsert> = {}) {
  return {
    code: "10",
    nom: "Développement économique",
    ...overrides,
  } satisfies typeof refCompetenceCategories.$inferInsert;
}

export function makeCompetence(overrides: Partial<typeof refCompetences.$inferInsert> = {}) {
  return {
    code: "10-100",
    nom: "Création, aménagement, entretien et gestion de zones d'activités",
    codeCategorie: "10",
    ...overrides,
  } satisfies typeof refCompetences.$inferInsert;
}

export function makeGroupementCompetence(overrides: Partial<typeof refGroupementCompetences.$inferInsert> = {}) {
  return {
    sirenGroupement: "200069193",
    codeCompetence: "10-100",
    ...overrides,
  } satisfies typeof refGroupementCompetences.$inferInsert;
}

// ============================================================
// Pre-built fixture sets for common test scenarios
// ============================================================

/**
 * A minimal complete dataset with:
 * - 3 communes (2 in dept 01, 1 in dept 69)
 * - 2 groupements (1 CC, 1 SIVU)
 * - 2 competence categories with 3 competences
 * - Perimetres linking communes to groupements
 * - Groupement-competence assignments
 */
export const FIXTURES = {
  categories: [
    makeCompetenceCategorie({ code: "10", nom: "Développement économique" }),
    makeCompetenceCategorie({ code: "20", nom: "Aménagement de l'espace" }),
  ],

  competences: [
    makeCompetence({
      code: "10-100",
      nom: "Zones d'activités industrielles",
      codeCategorie: "10",
    }),
    makeCompetence({
      code: "10-200",
      nom: "Actions de développement économique",
      codeCategorie: "10",
    }),
    makeCompetence({ code: "20-100", nom: "Schéma de cohérence territoriale", codeCategorie: "20" }),
  ],

  groupements: [
    makeGroupement({
      siren: "200069193",
      nom: "CC de la Dombes",
      type: "CC",
      population: 45000,
      nbCommunes: 2,
      departements: ["01"],
      regions: ["84"],
    }),
    makeGroupement({
      siren: "200066587",
      nom: "SIVU Eau et Assainissement du Bugey",
      type: "SIVU",
      population: 12000,
      nbCommunes: 1,
      departements: ["01"],
      regions: ["84"],
      modeFinancement: null,
    }),
  ],

  communes: [
    makeCommune({
      codeInsee: "01001",
      siren: "210100012",
      nom: "L'Abergement-Clémenciat",
      population: 800,
      codeDepartement: "01",
      codeRegion: "84",
      codeEpci: "200069193",
      codesPostaux: ["01400"],
    }),
    makeCommune({
      codeInsee: "01002",
      siren: "210100020",
      nom: "L'Abergement-de-Varey",
      population: 250,
      codeDepartement: "01",
      codeRegion: "84",
      codeEpci: "200069193",
      codesPostaux: ["01640"],
    }),
    makeCommune({
      codeInsee: "69123",
      siren: "216901231",
      nom: "Lyon",
      population: 522969,
      codeDepartement: "69",
      codeRegion: "84",
      codeEpci: null,
      codesPostaux: ["69001", "69002", "69003"],
    }),
  ],

  perimetres: [
    makePerimetre({ sirenGroupement: "200069193", codeInseeCommune: "01001" }),
    makePerimetre({ sirenGroupement: "200069193", codeInseeCommune: "01002" }),
    makePerimetre({
      sirenGroupement: "200066587",
      codeInseeCommune: "01001",
      categorieMembre: "commune",
    }),
  ],

  groupementCompetences: [
    makeGroupementCompetence({ sirenGroupement: "200069193", codeCompetence: "10-100" }),
    makeGroupementCompetence({ sirenGroupement: "200069193", codeCompetence: "20-100" }),
    makeGroupementCompetence({ sirenGroupement: "200066587", codeCompetence: "10-200" }),
  ],
};

/**
 * Insert the complete FIXTURES set into the database in FK-safe order.
 */
export async function seedReferentielFixtures(db: DatabaseService["database"]) {
  await db.insert(refCompetenceCategories).values(FIXTURES.categories);
  await db.insert(refCompetences).values(FIXTURES.competences);
  await db.insert(refGroupements).values(FIXTURES.groupements);
  await db.insert(refCommunes).values(FIXTURES.communes);
  await db.insert(refPerimetres).values(FIXTURES.perimetres);
  await db.insert(refGroupementCompetences).values(FIXTURES.groupementCompetences);
}
