import { TestingModule } from "@nestjs/testing";
import { ClassificationService } from "./classification.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestDatabaseService } from "@test/helpers/test-database.service";

/**
 * Integration tests for ClassificationService
 * These tests call the actual Anthropic LLM API to verify classification quality
 *
 * IMPORTANT: These tests require:
 * - ANTHROPIC_API_KEY environment variable to be set
 * - They are slower and consume API credits
 *
 * Ground truth reference: "Référence" spreadsheet
 */
describe("ClassificationService - Integration Tests", () => {
  let classificationService: ClassificationService;
  let module: TestingModule;
  let testDbService: TestDatabaseService;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    classificationService = module.get<ClassificationService>(ClassificationService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 10000);

  describe("Projet classification - Real LLM calls", () => {
    it("should classify a building renovation project", async () => {
      const result = await classificationService.classify("Rénovation thermique du gymnase Marcel Rouault", "projet");

      // Thematiques: should include renovation energetique and/or isolation thermique
      const thLabels = result.thematiques.map((t) => t.label);
      const hasRenovation = thLabels.some(
        (l) => l.includes("rénovation énergétique") || l.includes("Isolation thermique"),
      );
      expect(hasRenovation).toBe(true);

      // Sites: should include "Salle de sport ou gymnase"
      const siLabels = result.sites.map((s) => s.label);
      expect(siLabels).toContain("Salle de sport ou gymnase");

      // Interventions: should include "Rénovation bâtiment"
      const inLabels = result.interventions.map((i) => i.label);
      expect(inLabels).toContain("Rénovation bâtiment");

      // TE probability should be high for this project
      expect(result.probabiliteTE).toBeGreaterThan(0.5);

      // All scores should be between 0 and 1
      [...result.thematiques, ...result.sites, ...result.interventions].forEach((item) => {
        expect(item.score).toBeGreaterThanOrEqual(0);
        expect(item.score).toBeLessThanOrEqual(1);
      });
    }, 30000);

    it("should classify a bike path project", async () => {
      const result = await classificationService.classify(
        "Aménagement d'une piste cyclable sécurisée centre-ville — Les Batignolles",
        "projet",
      );

      const thLabels = result.thematiques.map((t) => t.label);
      // Should include bike-related thematique
      const hasBike = thLabels.some((l) => l.includes("piste cyclable") || l.includes("Vélo"));
      expect(hasBike).toBe(true);

      // Interventions: likely construction or amenagement
      expect(result.interventions.length).toBeGreaterThan(0);
    }, 30000);

    it("should handle a non-ecological project", async () => {
      const result = await classificationService.classify(
        "Création d'une salle de convivialité au complexe sportif",
        "projet",
      );

      // Should still return results (even non-ecological projects get classified)
      // But scores may be low, so after 0.8 threshold filtering, may have few results
      // TE probability should be low
      if (result.probabiliteTE !== null) {
        expect(result.probabiliteTE).toBeLessThan(0.5);
      }
    }, 30000);
  });

  describe("Aide classification - Real LLM calls", () => {
    it("should classify an aide without threshold filtering", async () => {
      const result = await classificationService.classify(
        "Financer l'acquisition de véhicules à motorisation décarbonée - La Banque des Territoires vous accompagne pour trouver le financement le plus adéquat pour acquérir des véhicules roulants propres.",
        "aide",
      );

      // Aides should return more labels (no 0.8 threshold)
      const totalLabels = result.thematiques.length + result.sites.length + result.interventions.length;
      expect(totalLabels).toBeGreaterThan(0);

      // Should detect vehicle/mobility thematiques
      const thLabels = result.thematiques.map((t) => t.label);
      const hasMobility = thLabels.some(
        (l) => l.includes("Décarbonation") || l.includes("véhicules") || l.includes("mobilité"),
      );
      expect(hasMobility).toBe(true);
    }, 30000);
  });

  describe("Score threshold validation", () => {
    it("should respect the default 0.8 score threshold for projets", async () => {
      const result = await classificationService.classify(
        "Installation de panneaux solaires sur le toit de l'école",
        "projet",
      );

      // All returned labels should have score >= 0.8
      [...result.thematiques, ...result.sites, ...result.interventions].forEach((item) => {
        expect(item.score).toBeGreaterThanOrEqual(0.8);
      });
    }, 30000);

    it("should return more labels with a lower threshold", async () => {
      const context = "Réhabilitation de l'ancien fournil de la boulangerie en tiers lieu";

      const [resultDefault, resultLow] = await Promise.all([
        classificationService.classify(context, "projet"),
        classificationService.classify(context, "projet", 0.3),
      ]);

      // Lower threshold should return more or equal labels
      const defaultTotal =
        resultDefault.thematiques.length + resultDefault.sites.length + resultDefault.interventions.length;
      const lowTotal = resultLow.thematiques.length + resultLow.sites.length + resultLow.interventions.length;
      expect(lowTotal).toBeGreaterThanOrEqual(defaultTotal);
    }, 60000); // 60s for 6 parallel LLM calls
  });

  describe("Enrichment validation", () => {
    it("should apply enrichment rules for projets", async () => {
      const result = await classificationService.classify(
        "Installation de panneaux solaires photovoltaïques sur toiture de l'école",
        "projet",
        0.3, // low threshold to see enrichment results
      );

      const thLabels = result.thematiques.map((t) => t.label);
      // If "Agrivoltaïsme, panneaux solaires sur le bâti" is found,
      // "Energies renouvelables" should be added by enrichment
      if (thLabels.includes("Agrivoltaïsme, panneaux solaires sur le bâti")) {
        expect(thLabels).toContain("Energies renouvelables");
      }
    }, 30000);
  });
});
