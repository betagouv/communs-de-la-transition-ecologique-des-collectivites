import { TcFetchService } from "./tc-fetch.service";
import { CustomLogger } from "@logging/logger.service";

// Sample TC opendata responses for testing
const SAMPLE_V1_CSV = [
  "Id;Date_creation;Date_modification;Date_lancement;Type_demarche;Nom;Description_rapide;SIREN collectivites_coporteuses;Collectivités porteuses;Population_couverte;Demarche_etat",
  "100;01/01/2020;15/03/2021;01/06/2019;PCAET;PCAET Communauté Test;Plan climat test;200000001;CC Test;50000;Publiée",
  "101;01/02/2020;20/04/2021;;PCAET;PCAET Sans Date;;CC Sans SIREN;30000;En cours",
].join("\n");

const SAMPLE_V2_CSV = [
  "Id;Date_creation;Date_modification;Date_lancement;Type_demarche;Nom;Description_rapide;SIREN collectivites_coporteuses;Collectivités porteuses;Population_couverte;Demarche_etat",
  "200;01/01/2022;15/03/2023;01/01/2022;PCAET;PCAET V2 Test;Plan V2;300000001;CA V2;80000;Publiée",
].join("\n");

const SAMPLE_V1_JSON = JSON.stringify([
  {
    id: 100,
    typesDemarche: [{ libcourt: "PCAET" }],
    actions: [
      {
        intitule: "Rénovation bâtiments publics",
        secteurs: [{ secteur: { libelle: "Bâtiment" } }],
        volets: [{ libelle: "Atténuation" }],
        typesPorteur: [{ libelle: "Collectivité" }],
      },
      {
        intitule: "Mobilité douce",
        secteurs: [{ secteur: { libelle: "Transport" } }],
        volets: [],
        typesPorteur: [],
      },
    ],
  },
]);

const SAMPLE_V2_JSON = JSON.stringify([
  {
    id: 200,
    typesDemarche: [{ libcourt: "PCAET" }],
    actions: [
      {
        intitule: "Plan vélo",
        secteurs: [{ secteur: { libelle: "Transport" } }],
        volets: [{ libelle: "Adaptation" }],
        typesPorteur: [{ libelle: "Collectivité" }],
      },
    ],
  },
]);

const SAMPLE_FICHES_CSV = [
  "Id_action;Id_demarche;Nom_demarche;Intitule_action;Description_action;Date_lancement;Type_action;Cible_action",
  "1;100;PCAET Test;Rénovation bâtiments publics;Rénover les bâtiments communaux;01/06/2019;Technique;Patrimoine public",
].join("\n");

describe("TcFetchService", () => {
  let service: TcFetchService;
  let fetchSpy: jest.SpyInstance;

  const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as unknown as CustomLogger;

  beforeEach(() => {
    service = new TcFetchService(mockLogger);
    jest.clearAllMocks();

    fetchSpy = jest.spyOn(global, "fetch").mockImplementation((input: string | Request | URL) => {
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      let body: string;

      if (urlStr.includes("V1_entete")) body = SAMPLE_V1_CSV;
      else if (urlStr.includes("V2_entete")) body = SAMPLE_V2_CSV;
      else if (urlStr.includes("Actions_V1")) body = SAMPLE_V1_JSON;
      else if (urlStr.includes("Actions_V2")) body = SAMPLE_V2_JSON;
      else if (urlStr.includes("Fiches_Action")) body = SAMPLE_FICHES_CSV;
      else return Promise.reject(new Error(`Unexpected URL: ${urlStr}`));

      return Promise.resolve(new Response(body, { status: 200 }));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should fetch and parse all TC opendata files", async () => {
    const { plans, fiches } = await service.fetchAndParse();

    expect(fetchSpy).toHaveBeenCalledTimes(5);
    expect(plans).toHaveLength(3); // 2 V1 + 1 V2
    expect(fiches).toHaveLength(3); // 2 V1 + 1 V2
  });

  describe("plan parsing", () => {
    it("should parse plans with correct fields", async () => {
      const { plans } = await service.fetchAndParse();

      const plan1 = plans.find((p) => p.tcDemarcheId === 100);
      expect(plan1).toEqual({
        nom: "PCAET Communauté Test",
        type: "PCAET",
        description: "Plan climat test",
        periodeDebut: "2019-06-01",
        periodeFin: "2025-06-01",
        collectiviteResponsableSiren: "200000001",
        territoireCommunes: null,
        tcDemarcheId: 100,
        tcVersion: "V1",
        tcEtat: "Publiée",
      });
    });

    it("should handle missing dates and invalid SIREN", async () => {
      const { plans } = await service.fetchAndParse();

      const plan2 = plans.find((p) => p.tcDemarcheId === 101);
      expect(plan2).toMatchObject({
        periodeDebut: null,
        periodeFin: null,
        collectiviteResponsableSiren: null,
      });
    });

    it("should assign correct version to each batch", async () => {
      const { plans } = await service.fetchAndParse();

      const v1Plans = plans.filter((p) => p.tcVersion === "V1");
      const v2Plans = plans.filter((p) => p.tcVersion === "V2");
      expect(v1Plans).toHaveLength(2);
      expect(v2Plans).toHaveLength(1);
    });
  });

  describe("fiche action parsing", () => {
    it("should parse fiches with secteurs and volets", async () => {
      const { fiches } = await service.fetchAndParse();

      const fiche1 = fiches.find((f) => f.nom === "Rénovation bâtiments publics");
      expect(fiche1).toMatchObject({
        nom: "Rénovation bâtiments publics",
        tcDemarcheId: 100,
        tcSecteurs: ["Bâtiment"],
        tcVolets: ["Atténuation"],
        tcTypesPorteur: ["Collectivité"],
        collectiviteResponsableSiren: "200000001",
      });
      expect(fiche1!.tcHash).toHaveLength(40);
    });

    it("should inherit SIREN from parent plan", async () => {
      const { fiches } = await service.fetchAndParse();

      const fichesForPlan200 = fiches.filter((f) => f.tcDemarcheId === 200);
      expect(fichesForPlan200).toHaveLength(1);
      expect(fichesForPlan200[0].collectiviteResponsableSiren).toBe("300000001");
    });
  });

  describe("enrichment", () => {
    it("should enrich fiches with description, type, and cible", async () => {
      const { fiches } = await service.fetchAndParse();

      const enriched = fiches.find((f) => f.nom === "Rénovation bâtiments publics");
      expect(enriched).toMatchObject({
        description: "Rénover les bâtiments communaux",
        tcTypeAction: "Technique",
        tcCibleAction: "Patrimoine public",
      });
    });

    it("should leave non-matching fiches unenriched", async () => {
      const { fiches } = await service.fetchAndParse();

      const notEnriched = fiches.find((f) => f.nom === "Plan vélo");
      expect(notEnriched).toMatchObject({
        description: null,
        tcTypeAction: null,
        tcCibleAction: null,
      });
    });
  });

  describe("error handling", () => {
    it("should throw on HTTP error", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("", { status: 500 }));
      await expect(service.fetchAndParse()).rejects.toThrow("Failed to fetch");
    });

    it("should strip BOM from CSV", async () => {
      fetchSpy.mockImplementation((input: string | Request | URL) => {
        const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (urlStr.includes("V1_entete")) {
          return Promise.resolve(new Response("\uFEFF" + SAMPLE_V1_CSV, { status: 200 }));
        }
        if (urlStr.includes("V2_entete")) return Promise.resolve(new Response(SAMPLE_V2_CSV, { status: 200 }));
        if (urlStr.includes("Actions_V1")) return Promise.resolve(new Response(SAMPLE_V1_JSON, { status: 200 }));
        if (urlStr.includes("Actions_V2")) return Promise.resolve(new Response(SAMPLE_V2_JSON, { status: 200 }));
        if (urlStr.includes("Fiches_Action")) return Promise.resolve(new Response(SAMPLE_FICHES_CSV, { status: 200 }));
        return Promise.reject(new Error(`Unexpected URL: ${urlStr}`));
      });

      const { plans } = await service.fetchAndParse();
      expect(plans.length).toBeGreaterThan(0);
    });
  });
});
