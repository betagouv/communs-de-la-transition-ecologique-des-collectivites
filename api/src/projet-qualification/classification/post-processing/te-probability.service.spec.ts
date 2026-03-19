/* eslint-disable @typescript-eslint/unbound-method */
import { TEProbabilityService } from "./te-probability.service";
import { CustomLogger } from "@logging/logger.service";

describe("TEProbabilityService", () => {
  let service: TEProbabilityService;
  let mockLogger: jest.Mocked<CustomLogger>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<CustomLogger>;
    service = new TEProbabilityService(mockLogger);
  });

  describe("calculate", () => {
    it("should return null for empty labels", () => {
      expect(service.calculate({})).toBeNull();
    });

    it("should calculate correctly for a single label", () => {
      // "Energie éolienne" has TE probability 1.0
      const result = service.calculate({ "Energie éolienne": 0.9 });
      // weighted avg = (0.9 * 1.0) / 0.9 = 1.0
      expect(result).toBe(1.0);
    });

    it("should calculate weighted average correctly", () => {
      // "Energie éolienne" = 1.0, "Réseaux" = 0.3
      const result = service.calculate({
        "Energie éolienne": 0.9, // weight 0.9, TE prob 1.0
        Réseaux: 0.6, // weight 0.6, TE prob 0.3
      });
      // weighted avg = (0.9*1.0 + 0.6*0.3) / (0.9+0.6) = (0.9+0.18)/1.5 = 1.08/1.5 = 0.72
      expect(result).toBe(0.72);
    });

    it("should return null when no labels have TE probabilities", () => {
      const result = service.calculate({ "Unknown label": 0.9 });
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should handle mix of known and unknown labels", () => {
      // Only "Sobriété énergétique" (1.0) is known, "Unknown" is ignored
      const result = service.calculate({
        "Sobriété énergétique": 0.8,
        "Unknown label": 0.5,
      });
      // weighted avg = (0.8*1.0) / 0.8 = 1.0
      expect(result).toBe(1.0);
    });

    it("should round to 2 decimal places", () => {
      // Check that result is properly rounded
      const result = service.calculate({
        "Energie éolienne": 0.9, // 1.0
        Voirie: 0.3, // 0.15
      });
      // (0.9*1.0 + 0.3*0.15) / (0.9+0.3) = (0.9+0.045)/1.2 = 0.945/1.2 = 0.7875
      // Rounded to 0.79
      expect(result).toBe(0.79);
    });

    it("should handle low TE probability labels", () => {
      // "Système de vidéo-protection et dispositifs anti-intrusion" = 0.0
      const result = service.calculate({
        "Système de vidéo-protection et dispositifs anti-intrusion": 0.9,
      });
      expect(result).toBe(0.0);
    });
  });
});
