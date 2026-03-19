import { EnrichmentService } from "./enrichment.service";
import { CustomLogger } from "@logging/logger.service";

describe("EnrichmentService", () => {
  let service: EnrichmentService;
  let mockLogger: jest.Mocked<CustomLogger>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<CustomLogger>;
    service = new EnrichmentService(mockLogger);
  });

  describe("enrich", () => {
    it("should add parent thematique when child is found", () => {
      const result = service.enrich({
        thematiques: { "Energie éolienne": 0.9 },
        sites: {},
        interventions: {},
      });

      expect(result.thematiques["Energie éolienne"]).toBe(0.9);
      expect(result.thematiques["Energies renouvelables"]).toBe(0.9); // parent added
    });

    it("should not add parent thematique if already present", () => {
      const result = service.enrich({
        thematiques: {
          "Energie éolienne": 0.9,
          "Energies renouvelables": 0.7, // already present with different score
        },
        sites: {},
        interventions: {},
      });

      expect(result.thematiques["Energies renouvelables"]).toBe(0.7); // original score kept
    });

    it("should add parent site when child is found", () => {
      const result = service.enrich({
        thematiques: {},
        sites: { "Bibliothèque municipale": 0.85 },
        interventions: {},
      });

      expect(result.sites["Bibliothèque municipale"]).toBe(0.85);
      expect(result.sites["Bâtiment public"]).toBe(0.85); // parent added
    });

    it("should handle cross-axis enrichment (site -> thematique)", () => {
      const result = service.enrich({
        thematiques: {},
        sites: { "Stationnements pour vélos": 0.8 },
        interventions: {},
      });

      expect(result.thematiques["Vélo (mobilité douce)"]).toBe(0.8); // cross-axis
    });

    it("should not add cross-axis thematique if already present", () => {
      const result = service.enrich({
        thematiques: { "Vélo (mobilité douce)": 0.95 },
        sites: { "Stationnements pour vélos": 0.8 },
        interventions: {},
      });

      expect(result.thematiques["Vélo (mobilité douce)"]).toBe(0.95); // original kept
    });

    it("should handle multiple enrichment rules", () => {
      const result = service.enrich({
        thematiques: {
          "Chauffage bois": 0.9,
          "Réseau de chaleur": 0.7,
        },
        sites: { Mairie: 0.8 },
        interventions: { "Rénovation bâtiment": 0.9 },
      });

      // Chauffage bois -> Chauffage renouvelable (parent added)
      expect(result.thematiques["Chauffage renouvelable"]).toBe(0.9);
      // Réseau de chaleur -> Réseaux
      expect(result.thematiques["Réseaux"]).toBe(0.7);
      // Mairie -> Bâtiment public
      expect(result.sites["Bâtiment public"]).toBe(0.8);
      // Interventions untouched (no enrichment rules for interventions)
      expect(result.interventions).toEqual({ "Rénovation bâtiment": 0.9 });
    });

    it("should not mutate input", () => {
      const input = {
        thematiques: { "Energie éolienne": 0.9 },
        sites: {},
        interventions: {},
      };
      const original = JSON.parse(JSON.stringify(input));

      service.enrich(input);

      expect(input).toEqual(original); // input unchanged
    });

    it("should handle empty input", () => {
      const result = service.enrich({
        thematiques: {},
        sites: {},
        interventions: {},
      });

      expect(result.thematiques).toEqual({});
      expect(result.sites).toEqual({});
      expect(result.interventions).toEqual({});
    });
  });
});
