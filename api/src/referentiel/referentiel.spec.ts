import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { seedReferentielFixtures } from "@test/mocks/mockReferentielFixtures";
import { CommunesService } from "./communes/communes.service";
import { GroupementsService } from "./groupements/groupements.service";
import { CompetencesService } from "./competences/competences.service";
import { RechercheService } from "./recherche/recherche.service";

describe("Referentiel", () => {
  let module: TestingModule;
  let testDbService: TestDatabaseService;
  let communesService: CommunesService;
  let groupementsService: GroupementsService;
  let competencesService: CompetencesService;
  let rechercheService: RechercheService;

  beforeAll(async () => {
    const result = await testModule();
    module = result.module;
    testDbService = result.testDbService;
    communesService = module.get<CommunesService>(CommunesService);
    groupementsService = module.get<GroupementsService>(GroupementsService);
    competencesService = module.get<CompetencesService>(CompetencesService);
    rechercheService = module.get<RechercheService>(RechercheService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 10000);

  beforeEach(async () => {
    await testDbService.cleanDatabase();
    await seedReferentielFixtures(testDbService.database);
  });

  // ============================================================
  // CommunesService
  // ============================================================
  describe("CommunesService", () => {
    describe("search", () => {
      it("should find a commune by codeInsee", async () => {
        const results = await communesService.search({ codeInsee: "01001" });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
          code: "01001",
          nom: "L'Abergement-Clémenciat",
          siren: "210100012",
        });
      });

      it("should find a commune by siren", async () => {
        const results = await communesService.search({ siren: "210100012" });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
          code: "01001",
          siren: "210100012",
        });
      });

      it("should return empty array for unknown codeInsee", async () => {
        const results = await communesService.search({ codeInsee: "99999" });
        expect(results).toHaveLength(0);
      });

      it("should search communes by name with pg_trgm", async () => {
        const results = await communesService.search({ q: "Abergement" });

        expect(results.length).toBeGreaterThanOrEqual(1);
        const names = results.map((r) => r.nom);
        expect(names).toContain("L'Abergement-Clémenciat");
      });

      it("should search with accent-insensitive matching", async () => {
        const results = await communesService.search({ q: "Clemenciat" });

        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].nom).toBe("L'Abergement-Clémenciat");
      });

      it("should filter by codeDepartement", async () => {
        const results = await communesService.search({ codeDepartement: "01" });

        expect(results).toHaveLength(2);
        results.forEach((r) => expect(r.codeDepartement).toBe("01"));
      });

      it("should filter by codeEpci", async () => {
        const results = await communesService.search({ codeEpci: "200069193" });

        expect(results).toHaveLength(2);
        results.forEach((r) => expect(r.codeEpci).toBe("200069193"));
      });

      it("should combine text search with department filter", async () => {
        const results = await communesService.search({
          q: "Abergement",
          codeDepartement: "69",
        });

        // No commune named Abergement in dept 69
        expect(results).toHaveLength(0);
      });

      it("should return all communes when no filters", async () => {
        const results = await communesService.search({});

        expect(results).toHaveLength(3);
      });

      it("should respect pagination", async () => {
        const results = await communesService.search({ limit: 1, offset: 0 });
        expect(results).toHaveLength(1);

        const results2 = await communesService.search({ limit: 1, offset: 1 });
        expect(results2).toHaveLength(1);
        expect(results2[0].code).not.toBe(results[0].code);
      });
    });

    describe("findOne", () => {
      it("should return commune detail with groupements", async () => {
        const detail = await communesService.findOne("01001");

        expect(detail.code).toBe("01001");
        expect(detail.nom).toBe("L'Abergement-Clémenciat");
        expect(detail.population).toBe(800);
        expect(detail.codesPostaux).toEqual(["01400"]);
        // Commune 01001 belongs to 2 groupements via perimetres
        expect(detail.groupements).toHaveLength(2);
        const sirenSet = new Set(detail.groupements.map((g) => g.siren));
        expect(sirenSet).toContain("200069193");
        expect(sirenSet).toContain("200066587");
      });

      it("should throw NotFoundException for unknown commune", async () => {
        await expect(communesService.findOne("99999")).rejects.toThrow(NotFoundException);
      });
    });

    describe("getCompetences", () => {
      it("should return competences exercised on the commune territory", async () => {
        const results = await communesService.getCompetences("01001");

        // Commune 01001 is covered by CC de la Dombes (10-100, 20-100) and SIVU (10-200)
        expect(results.length).toBe(3);

        const codes = results.map((r) => r.competence.code);
        expect(codes).toContain("10-100");
        expect(codes).toContain("10-200");
        expect(codes).toContain("20-100");

        // Verify structure
        results.forEach((r) => {
          expect(r.competence).toHaveProperty("code");
          expect(r.competence).toHaveProperty("nom");
          expect(r.competence).toHaveProperty("categorie");
          expect(r.groupement).toHaveProperty("siren");
          expect(r.groupement).toHaveProperty("nom");
          expect(r.groupement).toHaveProperty("type");
        });
      });

      it("should throw NotFoundException for unknown commune", async () => {
        await expect(communesService.getCompetences("99999")).rejects.toThrow(NotFoundException);
      });
    });
  });

  // ============================================================
  // GroupementsService
  // ============================================================
  describe("GroupementsService", () => {
    describe("search", () => {
      it("should find groupement by siren", async () => {
        const results = await groupementsService.search({ siren: "200069193" });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
          siren: "200069193",
          nom: "CC de la Dombes",
          type: "CC",
        });
      });

      it("should find groupement by siret (extracts siren)", async () => {
        const results = await groupementsService.search({ siret: "20006919300010" });

        expect(results).toHaveLength(1);
        expect(results[0].siren).toBe("200069193");
      });

      it("should search by name with pg_trgm", async () => {
        const results = await groupementsService.search({ q: "Dombes" });

        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].nom).toContain("Dombes");
      });

      it("should filter by type", async () => {
        const results = await groupementsService.search({ type: "SIVU" });

        expect(results).toHaveLength(1);
        expect(results[0].type).toBe("SIVU");
      });

      it("should filter by multiple types", async () => {
        const results = await groupementsService.search({ type: "CC,SIVU" });

        expect(results).toHaveLength(2);
      });

      it("should filter by departement", async () => {
        const results = await groupementsService.search({ departement: "01" });

        expect(results).toHaveLength(2);
      });

      it("should filter by competence", async () => {
        const results = await groupementsService.search({ competence: "20-100" });

        // Only CC de la Dombes has competence 20-100
        expect(results).toHaveLength(1);
        expect(results[0].siren).toBe("200069193");
      });

      it("should filter by commune", async () => {
        const results = await groupementsService.search({ commune: "01001" });

        // Commune 01001 is in both groupements
        expect(results).toHaveLength(2);
      });

      it("should return all groupements with no filters", async () => {
        const results = await groupementsService.search({});

        expect(results).toHaveLength(2);
      });
    });

    describe("findOne", () => {
      it("should return full groupement details", async () => {
        const result = await groupementsService.findOne("200069193");

        expect(result).toMatchObject({
          siren: "200069193",
          nom: "CC de la Dombes",
          type: "CC",
          population: 45000,
          nbCommunes: 2,
          departements: ["01"],
          regions: ["84"],
          modeFinancement: "FPU",
          dateCreation: "2017-01-01",
        });
      });

      it("should throw NotFoundException for unknown siren", async () => {
        await expect(groupementsService.findOne("999999999")).rejects.toThrow(NotFoundException);
      });
    });

    describe("getMembres", () => {
      it("should return communes belonging to the groupement", async () => {
        const membres = await groupementsService.getMembres("200069193");

        expect(membres).toHaveLength(2);
        const codes = membres.map((m) => m.code);
        expect(codes).toContain("01001");
        expect(codes).toContain("01002");

        membres.forEach((m) => {
          expect(m).toHaveProperty("code");
          expect(m).toHaveProperty("nom");
          expect(m).toHaveProperty("population");
          expect(m).toHaveProperty("categorieMembre");
        });
      });

      it("should return members ordered by name", async () => {
        const membres = await groupementsService.getMembres("200069193");

        const names = membres.map((m) => m.nom);
        expect(names).toEqual([...names].sort());
      });

      it("should throw NotFoundException for unknown groupement", async () => {
        await expect(groupementsService.getMembres("999999999")).rejects.toThrow(NotFoundException);
      });
    });

    describe("getCompetences", () => {
      it("should return competences of the groupement", async () => {
        const results = await groupementsService.getCompetences("200069193");

        expect(results).toHaveLength(2);
        const codes = results.map((r) => r.code);
        expect(codes).toContain("10-100");
        expect(codes).toContain("20-100");

        results.forEach((r) => {
          expect(r).toHaveProperty("code");
          expect(r).toHaveProperty("nom");
          expect(r.categorie).toHaveProperty("code");
          expect(r.categorie).toHaveProperty("nom");
        });
      });

      it("should throw NotFoundException for unknown groupement", async () => {
        await expect(groupementsService.getCompetences("999999999")).rejects.toThrow(NotFoundException);
      });
    });
  });

  // ============================================================
  // CompetencesService
  // ============================================================
  describe("CompetencesService", () => {
    describe("findAll", () => {
      it("should return all competences with categories", async () => {
        const results = await competencesService.findAll();

        expect(results).toHaveLength(3);
        results.forEach((r) => {
          expect(r).toHaveProperty("code");
          expect(r).toHaveProperty("nom");
          expect(r.categorie).toHaveProperty("code");
          expect(r.categorie).toHaveProperty("nom");
        });
      });

      it("should filter by categorie", async () => {
        const results = await competencesService.findAll("10");

        expect(results).toHaveLength(2);
        results.forEach((r) => expect(r.categorie.code).toBe("10"));
      });

      it("should return empty for unknown categorie", async () => {
        const results = await competencesService.findAll("99");
        expect(results).toHaveLength(0);
      });

      it("should return competences ordered by categorie then code", async () => {
        const results = await competencesService.findAll();
        const codes = results.map((r) => r.code);
        expect(codes).toEqual([...codes].sort());
      });
    });

    describe("findOne", () => {
      it("should return a single competence with categorie", async () => {
        const result = await competencesService.findOne("10-100");

        expect(result).toMatchObject({
          code: "10-100",
          nom: "Zones d'activités industrielles",
          categorie: { code: "10", nom: "Développement économique" },
        });
      });

      it("should throw NotFoundException for unknown code", async () => {
        await expect(competencesService.findOne("99-999")).rejects.toThrow(NotFoundException);
      });
    });

    describe("getGroupements", () => {
      it("should return groupements having the competence", async () => {
        const results = await competencesService.getGroupements("10-100", {});

        expect(results).toHaveLength(1);
        expect(results[0].siren).toBe("200069193");
      });

      it("should filter groupements by commune", async () => {
        // Competence 10-200 is held by SIVU which covers 01001
        const results = await competencesService.getGroupements("10-200", {
          commune: "01001",
        });

        expect(results).toHaveLength(1);
        expect(results[0].siren).toBe("200066587");
      });

      it("should filter groupements by type", async () => {
        const results = await competencesService.getGroupements("10-200", {
          type: "CC",
        });

        // Competence 10-200 is only on SIVU, not CC
        expect(results).toHaveLength(0);
      });

      it("should throw NotFoundException for unknown competence", async () => {
        await expect(competencesService.getGroupements("99-999", {})).rejects.toThrow(NotFoundException);
      });
    });
  });

  // ============================================================
  // RechercheService
  // ============================================================
  describe("RechercheService", () => {
    describe("search", () => {
      it("should return both communes and groupements", async () => {
        // "Dombes" should match the groupement, "Lyon" should match commune
        const result = await rechercheService.search({ q: "Dombes" });

        expect(result.groupements.length).toBeGreaterThanOrEqual(1);
        expect(result.groupements[0]).toMatchObject({
          nom: expect.stringContaining("Dombes"),
          famille: "groupement",
        });
      });

      it("should search communes", async () => {
        const result = await rechercheService.search({ q: "Lyon" });

        expect(result.communes.length).toBeGreaterThanOrEqual(1);
        expect(result.communes[0]).toMatchObject({
          id: "69123",
          nom: "Lyon",
          famille: "commune",
        });
      });

      it("should filter by famille commune", async () => {
        const result = await rechercheService.search({
          q: "Abergement",
          famille: "commune",
        });

        expect(result.communes.length).toBeGreaterThanOrEqual(1);
        expect(result.groupements).toHaveLength(0);
      });

      it("should filter by famille groupement", async () => {
        const result = await rechercheService.search({
          q: "Dombes",
          famille: "groupement",
        });

        expect(result.communes).toHaveLength(0);
        expect(result.groupements.length).toBeGreaterThanOrEqual(1);
      });

      it("should respect limit parameter", async () => {
        const result = await rechercheService.search({
          q: "Abergement",
          limit: 1,
        });

        expect(result.communes.length).toBeLessThanOrEqual(1);
      });

      it("should return empty results for non-matching query", async () => {
        const result = await rechercheService.search({ q: "ZZZZZZZZ" });

        expect(result.communes).toHaveLength(0);
        expect(result.groupements).toHaveLength(0);
      });

      it("should return empty results for whitespace-only query", async () => {
        const result = await rechercheService.search({ q: "   " });

        expect(result.communes).toHaveLength(0);
        expect(result.groupements).toHaveLength(0);
      });
    });
  });
});
