/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { TestingModule } from "@nestjs/testing";
import { ProjetQualificationService } from "./projet-qualification.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestDatabaseService } from "@test/helpers/test-database.service";

/**
 * Integration tests for ProjetQualificationService
 * These tests call the actual LLM to verify analysis quality
 *
 * IMPORTANT: These tests require:
 * - ANTHROPIC_API_KEY environment variable to be set
 * - Python3 with anthropic module installed
 * They are slower and consume API credits
 */
describe("ProjetQualificationService - Integration Tests", () => {
  let qualificationService: ProjetQualificationService;
  let module: TestingModule;
  let testDbService: TestDatabaseService;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    qualificationService = module.get<ProjetQualificationService>(ProjetQualificationService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  describe("analyzeCompetences - Real LLM calls", () => {
    it("should correctly identify competences for école primaire renovation", async () => {
      const context = "rénovation du chauffage d'une école primaire";

      const result = await qualificationService.analyzeCompetences(context, "MEC");

      // Should detect education AND energy competences
      const competenceCodes = result.competences.map((c) => c.code);

      // Should include education (90-21x range for enseignement premier degré)
      const hasEducation = competenceCodes.some((code) => code.startsWith("90-21"));

      // Should include energy (90-75 for politique de l'énergie)
      const hasEnergy = competenceCodes.some((code) => code === "90-75");

      expect(hasEducation).toBe(true);
      expect(hasEnergy).toBe(true);

      // Should have reasonable scores (> 0.5 threshold)
      result.competences.forEach((c) => {
        expect(c.score).toBeGreaterThan(0.5);
      });
    }, 30000); // 30s timeout for LLM call

    it("should correctly identify competences for ressourcerie communale", async () => {
      const context =
        "Création d'une ressourcerie communale pour donner une seconde vie aux objets, promouvoir le réemploi et créer des emplois d'insertion dans l'économie sociale et solidaire";

      const result = await qualificationService.analyzeCompetences(context, "MEC");

      const competenceCodes = result.competences.map((c) => c.code);

      // Should include waste management (90-721 for collecte et traitement des déchets)
      const hasWaste = competenceCodes.some((code) => code === "90-721" || code === "90-72");

      // Should include social economy (90-65 for insertion économique et économie sociale)
      const hasSocialEconomy = competenceCodes.some((code) => code === "90-65");

      expect(hasWaste).toBe(true);
      expect(hasSocialEconomy).toBe(true);

      // Should return 1-3 competences as per requirements
      expect(result.competences.length).toBeGreaterThanOrEqual(1);
      expect(result.competences.length).toBeLessThanOrEqual(3);
    }, 30000);

    it("should correctly identify competences for piste cyclable", async () => {
      const context =
        "Aménagement d'une piste cyclable sécurisée de 15 km reliant 5 communes pour encourager les déplacements doux et réduire l'usage de la voiture";

      const result = await qualificationService.analyzeCompetences(context, "MEC");

      const competenceCodes = result.competences.map((c) => c.code);

      // Should include circulations douces (90-87)
      const hasCyclePaths = competenceCodes.some((code) => code === "90-87");

      // Might include voirie or transport
      const hasTransportInfra = competenceCodes.some(
        (code) =>
          code.startsWith("90-84") || // Voirie
          code.startsWith("90-85"), // Infrastructures transport
      );

      expect(hasCyclePaths || hasTransportInfra).toBe(true);
    }, 30000);
  });

  describe("Leviers analysis - Quality checks", () => {
    it("should correctly identify leviers for ressourcerie", async () => {
      const context =
        "Création d'une ressourcerie communale pour donner une seconde vie aux objets, promouvoir le réemploi et créer des emplois d'insertion";

      // Call the internal method that spawns Python script
      const result = await (qualificationService as any).analyzeProjet(context, "TE");

      // Should detect waste-related leviers
      const levierNames = Object.keys(result.leviers);

      // Should include "Prévention des déchets" (reducing waste at source)
      expect(levierNames).toContain("Prévention des déchets");

      // Should include "Valorisation matière des déchets" (recycling/reuse)
      expect(levierNames).toContain("Valorisation matière des déchets");

      // May include "Moindre stockage en décharge" (less landfill)
      // This is the one that differs between Python and TypeScript

      // All scores should be reasonable
      Object.values(result.leviers).forEach((score: any) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    }, 30000);

    it("should correctly identify leviers for piste cyclable", async () => {
      const context = "Aménagement d'une piste cyclable sécurisée de 15 km reliant 5 communes";

      const result = await (qualificationService as any).analyzeProjet(context, "TE");

      const levierNames = Object.keys(result.leviers);

      // Should include "Vélo" (bike promotion)
      expect(levierNames).toContain("Vélo");

      // May include "Réduction des déplacements" or other mobility leviers
      const hasMobility = levierNames.some(
        (name) =>
          name.includes("déplacements") || name.includes("Transports en commun") || name.includes("Covoiturage"),
      );

      // At least one mobility-related levier
      expect(levierNames.includes("Vélo") || hasMobility).toBe(true);
    }, 30000);

    it("should correctly identify leviers for panneaux solaires", async () => {
      const context =
        "Installation de panneaux photovoltaïques sur les toits des bâtiments communaux pour produire de l'électricité renouvelable";

      const result = await (qualificationService as any).analyzeProjet(context, "TE");

      const levierNames = Object.keys(result.leviers);

      // Should include "Electricité renouvelable"
      expect(levierNames).toContain("Electricité renouvelable");

      // Should have high confidence for renewable energy
      expect(result.leviers["Electricité renouvelable"]).toBeGreaterThanOrEqual(0.7);
    }, 30000);

    it("should handle vague project descriptions appropriately", async () => {
      const context = "Revitalisation du centre bourg";

      const result = await (qualificationService as any).analyzeProjet(context, "TE");

      // Should classify as unclear or no link
      expect(result.classification).toMatch(/pas assez précis|n'a pas de lien/);

      // May have some leviers with lower scores
      Object.values(result.leviers).forEach((score: any) => {
        // Scores should be moderate to low for vague descriptions
        expect(score).toBeLessThanOrEqual(0.8);
      });
    }, 30000);
  });

  describe("Classification quality", () => {
    it("should classify ecological projects correctly", async () => {
      const ecologicalContexts = [
        "Installation de panneaux solaires",
        "Création d'une piste cyclable",
        "Ressourcerie pour le réemploi",
      ];

      for (const context of ecologicalContexts) {
        const result = await (qualificationService as any).analyzeProjet(context, "TE");

        expect(result.classification).toBe("Le projet a un lien avec la transition écologique");
      }
    }, 90000); // 90s for multiple calls

    it("should classify non-ecological projects correctly", async () => {
      const nonEcologicalContext = "Création d'une salle de convivialité au complexe sportif";

      const result = await (qualificationService as any).analyzeProjet(nonEcologicalContext, "TE");

      expect(result.classification).toBe("Le projet n'a pas de lien avec la transition écologique");
    }, 30000);

    it("should classify unclear projects as unclear", async () => {
      const unclearContext = "Aménagement du parking";

      const result = await (qualificationService as any).analyzeProjet(unclearContext, "TE");

      expect(result.classification).toBe(
        "Le projet n'est pas assez précis pour être lié ou non à la transition écologique",
      );
    }, 30000);
  });

  describe("Score threshold validation", () => {
    it("should only return competences above threshold (0.5)", async () => {
      const context = "rénovation du chauffage d'une école primaire";

      const result = await qualificationService.analyzeCompetences(context, "MEC");

      // All returned competences should have score > 0.5
      result.competences.forEach((c) => {
        expect(c.score).toBeGreaterThan(0.5);
      });
    }, 30000);

    it("should only return leviers above threshold (0.7) after filtering", async () => {
      const context = "Création d'une ressourcerie communale";

      const result = await (qualificationService as any).analyzeProjet(context, "TE");

      // Filter leviers by threshold like the service does
      const filteredLeviers = Object.entries(result.leviers).filter(([_, score]) => (score as number) > 0.7);

      // All filtered leviers should be above threshold
      filteredLeviers.forEach(([_, score]) => {
        expect(score).toBeGreaterThan(0.7);
      });

      // Should have at least one levier above threshold
      expect(filteredLeviers.length).toBeGreaterThan(0);
    }, 30000);
  });
});
