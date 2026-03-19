/* eslint-disable @typescript-eslint/unbound-method */
import { ClassificationValidationService } from "./classification-validation.service";
import { CustomLogger } from "@logging/logger.service";
import { ClassificationLLMResponse } from "../llm/prompts/types";

describe("ClassificationValidationService", () => {
  let service: ClassificationValidationService;
  let mockLogger: jest.Mocked<CustomLogger>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<CustomLogger>;
    service = new ClassificationValidationService(mockLogger);
  });

  describe("validateAndCorrect", () => {
    it("should keep valid thematique labels unchanged", () => {
      const response: ClassificationLLMResponse = {
        projet: "Test",
        items: [
          { label: "Sobriété énergétique", score: 0.9 },
          { label: "Energies renouvelables", score: 0.8 },
        ],
      };

      const result = service.validateAndCorrect(response, "thematiques");
      expect(result).toEqual({
        "Sobriété énergétique": 0.9,
        "Energies renouvelables": 0.8,
      });
    });

    it("should correct labels with typos via Levenshtein", () => {
      const response: ClassificationLLMResponse = {
        projet: "Test",
        items: [
          { label: "Sobriété energétique", score: 0.9 }, // missing accent
        ],
      };

      const result = service.validateAndCorrect(response, "thematiques");
      // Should be corrected to "Sobriété énergétique"
      expect(Object.keys(result)).toHaveLength(1);
      expect(result["Sobriété énergétique"]).toBe(0.9);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should remove labels with no close match", () => {
      const response: ClassificationLLMResponse = {
        projet: "Test",
        items: [{ label: "Completely invented label that does not exist", score: 0.9 }],
      };

      const result = service.validateAndCorrect(response, "thematiques");
      expect(Object.keys(result)).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Removed invalid label"));
    });

    it("should keep highest score when duplicates after correction", () => {
      const response: ClassificationLLMResponse = {
        projet: "Test",
        items: [
          { label: "Sobriété énergétique", score: 0.7 },
          { label: "Sobriété énergétique", score: 0.9 },
        ],
      };

      const result = service.validateAndCorrect(response, "thematiques");
      expect(result["Sobriété énergétique"]).toBe(0.9);
    });

    it("should validate against sites referential", () => {
      const response: ClassificationLLMResponse = {
        projet: "Test",
        items: [
          { label: "Ecole", score: 0.9 },
          { label: "Mairie", score: 0.8 },
        ],
      };

      const result = service.validateAndCorrect(response, "sites");
      expect(result).toEqual({
        Ecole: 0.9,
        Mairie: 0.8,
      });
    });

    it("should validate against interventions referential", () => {
      const response: ClassificationLLMResponse = {
        projet: "Test",
        items: [
          { label: "Rénovation bâtiment", score: 0.9 },
          { label: "Formation", score: 0.7 },
        ],
      };

      const result = service.validateAndCorrect(response, "interventions");
      expect(result).toEqual({
        "Rénovation bâtiment": 0.9,
        Formation: 0.7,
      });
    });

    it("should handle empty items array", () => {
      const response: ClassificationLLMResponse = {
        projet: "Test",
        items: [],
      };

      const result = service.validateAndCorrect(response, "thematiques");
      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
