import { BadRequestException } from "@nestjs/common";
import {
  decodeCursor,
  encodeCursor,
  LABELS_METHODE,
  parseMillesime,
  ProjetRow,
  toProjetConsultation,
} from "./consultation-projection";

const baseRow = (overrides: Partial<ProjetRow> = {}): ProjetRow => ({
  id: "00000000-0000-5000-8000-000000000001",
  nom: "Rénovation de l'école",
  description: "Isolation et chaufferie",
  budget_previsionnel: "250000",
  date_debut: "2023-03-01",
  date_fin: null,
  phase: "Réalisation",
  phase_statut: "En cours",
  collectivite_responsable_siren: "217500016",
  porteur_operationnel_siret: "21750001600019",
  porteur_nom: "Ville de Paris",
  territoire_communes: ["75056"],
  territoire_departement: "75",
  localisation_latitude: 48.85,
  localisation_longitude: 2.35,
  localisation_adresse: "1 rue de l'École",
  localisation_ban_id: "75056_1234",
  plan_transition_ids: null,
  programmes_rattachement: ["CRTE"],
  ouverture: "ouvert",
  nb_lignes: 1,
  sources: [{ source: "dgcl", idSource: "00000000-0000-5000-8000-000000000001", role: "inchange" }],
  financements: [
    {
      source: "DETR",
      referenceExterne: null,
      dateAttribution: "2023-01-01",
      montantDemande: null,
      montantAttribue: 80000.5,
      statut: "Obtenu",
    },
  ],
  labels_present: true,
  classification_thematiques: ["Bâtiments publics"],
  classification_sites: ["École"],
  classification_interventions: ["Rénovation"],
  leviers: ["Rénovation (tertiaire)"],
  competences_m57: ["90-212"],
  nature: "Projet opérationnel",
  nature_confiance: 0.9300000071525574,
  te_global: 0.8799999952316284,
  te_attenuation: 0.8,
  te_adaptation: 0.1,
  te_biodiversite: null,
  bv_attenuation_cotation: "favorable",
  bv_adaptation_cotation: "neutre",
  bv_eau_cotation: "non coté",
  bv_circulaire_cotation: "non coté",
  bv_pollution_cotation: "non coté",
  bv_biodiversite_cotation: "non coté",
  ...overrides,
});

describe("toProjetConsultation", () => {
  it("projects the base columns to the v0.2.0 camelCase contract with proper types", () => {
    const projet = toProjetConsultation(baseRow());

    expect(projet).toMatchObject({
      nom: "Rénovation de l'école",
      description: "Isolation et chaufferie",
      budgetPrevisionnel: 250000,
      dateDebut: "2023-03-01",
      dateFin: null,
      phase: "Réalisation",
      phaseStatut: "En cours",
      collectiviteResponsableSiren: "217500016",
      porteurOperationnelSiret: "21750001600019",
      porteurNom: "Ville de Paris",
      territoireCommunes: ["75056"],
      territoireDepartements: ["75"],
      localisationLatitude: 48.85,
      localisationLongitude: 2.35,
      localisationAdresse: "1 rue de l'École",
      localisationBanId: "75056_1234",
      planTransitionIds: [],
      programmesRattachement: ["CRTE"],
      ouverture: "ouvert",
      nbLignesRegroupees: 1,
    });
  });

  it("never exposes the internal uuid: the reference is the source keys block", () => {
    const projet = toProjetConsultation(baseRow());

    expect(projet).not.toHaveProperty("id");
    expect(projet.sources).toEqual([
      { source: "dgcl", idSource: "00000000-0000-5000-8000-000000000001", role: "inchange" },
    ]);
  });

  it("flags the labels as provisional and versioned by method, with rounded scores", () => {
    const { labels } = toProjetConsultation(baseRow());

    expect(labels).toEqual({
      provisoire: true,
      methode: LABELS_METHODE,
      classificationThematiques: ["Bâtiments publics"],
      classificationSites: ["École"],
      classificationInterventions: ["Rénovation"],
      leviersSgpe: ["Rénovation (tertiaire)"],
      competencesM57: ["90-212"],
      nature: "Projet opérationnel",
      natureConfiance: 0.93,
      probabiliteTe: { global: 0.88, attenuation: 0.8, adaptation: 0.1, biodiversite: null },
      budgetVert: {
        attenuation: "favorable",
        adaptation: "neutre",
        eau: "non coté",
        circulaire: "non coté",
        pollution: "non coté",
        biodiversite: "non coté",
      },
    });
  });

  it("returns labels null for a project without a labels row", () => {
    const projet = toProjetConsultation(baseRow({ labels_present: false, classification_thematiques: null }));
    expect(projet.labels).toBeNull();
  });

  it("exposes the financing lines without montantPaye", () => {
    const projet = toProjetConsultation(baseRow());

    expect(projet.financements).toEqual([
      {
        source: "DETR",
        referenceExterne: null,
        dateAttribution: "2023-01-01",
        montantDemande: null,
        montantAttribue: 80000.5,
        statut: "Obtenu",
      },
    ]);
    expect(projet.financements[0]).not.toHaveProperty("montantPaye");
  });

  it("defaults missing aggregates and arrays to empty lists", () => {
    const projet = toProjetConsultation(
      baseRow({ sources: null, financements: null, territoire_communes: null, programmes_rattachement: null }),
    );
    expect(projet.sources).toEqual([]);
    expect(projet.financements).toEqual([]);
    expect(projet.territoireCommunes).toEqual([]);
    expect(projet.programmesRattachement).toEqual([]);
  });

  it("splits the pipe-separated departments and handles a missing budget", () => {
    const projet = toProjetConsultation(baseRow({ territoire_departement: "13|83|84", budget_previsionnel: null }));
    expect(projet.territoireDepartements).toEqual(["13", "83", "84"]);
    expect(projet.budgetPrevisionnel).toBeNull();

    expect(toProjetConsultation(baseRow({ territoire_departement: null })).territoireDepartements).toEqual([]);
  });
});

describe("cursor", () => {
  it("round-trips a position (siren + line id) through an opaque token", () => {
    const position = { siren: "217500016", id: "00000000-0000-5000-8000-000000000001" };
    const token = encodeCursor(position);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(token)).toEqual(position);
  });

  it("round-trips a position among the projects without a SIREN", () => {
    const position = { siren: null, id: "00000000-0000-5000-8000-000000000001" };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it.each([
    ["not base64 json", "###"],
    ["wrong shape", Buffer.from(JSON.stringify({ foo: 1 })).toString("base64url")],
    [
      "invalid siren",
      Buffer.from(JSON.stringify({ s: "12", i: "00000000-0000-5000-8000-000000000001" })).toString("base64url"),
    ],
    ["invalid id", Buffer.from(JSON.stringify({ s: "217500016", i: "x'; DROP" })).toString("base64url")],
  ])("rejects a malformed cursor (%s) with a 400", (_label, token) => {
    expect(() => decodeCursor(token)).toThrow(BadRequestException);
  });
});

describe("parseMillesime", () => {
  it("accepts a four-digit year", () => {
    expect(parseMillesime("2024")).toBe(2024);
  });

  it("returns undefined when absent", () => {
    expect(parseMillesime(undefined)).toBeUndefined();
  });

  it.each(["24", "abcd", "20245", "1899", "2101"])("rejects %s with a 400", (value) => {
    expect(() => parseMillesime(value)).toThrow(BadRequestException);
  });
});
