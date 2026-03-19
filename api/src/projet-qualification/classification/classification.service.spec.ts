/* eslint-disable @typescript-eslint/unbound-method */
import { InternalServerErrorException } from "@nestjs/common";
import { ClassificationService } from "./classification.service";
import { ClassificationAnthropicService } from "./llm/classification-anthropic.service";
import { ClassificationValidationService } from "./validation/classification-validation.service";
import { EnrichmentService } from "./post-processing/enrichment.service";
import { TEProbabilityService } from "./post-processing/te-probability.service";
import { CustomLogger } from "@logging/logger.service";
import { ClassificationAnalysisResult } from "./llm/prompts/types";

describe("ClassificationService", () => {
  let service: ClassificationService;
  let mockAnthropicService: jest.Mocked<ClassificationAnthropicService>;
  let mockValidationService: jest.Mocked<ClassificationValidationService>;
  let mockEnrichmentService: jest.Mocked<EnrichmentService>;
  let mockTEService: jest.Mocked<TEProbabilityService>;
  let mockLogger: jest.Mocked<CustomLogger>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<CustomLogger>;

    mockAnthropicService = {
      analyzeThematiques: jest.fn(),
      analyzeSites: jest.fn(),
      analyzeInterventions: jest.fn(),
    } as unknown as jest.Mocked<ClassificationAnthropicService>;

    mockValidationService = {
      validateAndCorrect: jest.fn(),
    } as unknown as jest.Mocked<ClassificationValidationService>;

    mockEnrichmentService = {
      enrich: jest.fn(),
    } as unknown as jest.Mocked<EnrichmentService>;

    mockTEService = {
      calculate: jest.fn(),
    } as unknown as jest.Mocked<TEProbabilityService>;

    service = new ClassificationService(
      mockAnthropicService,
      mockValidationService,
      mockEnrichmentService,
      mockTEService,
      mockLogger,
    );
  });

  function mockLLMResult(items: { label: string; score: number }[]): ClassificationAnalysisResult {
    return {
      json: { projet: "Test", items },
    };
  }

  describe("classify - projet", () => {
    it("should orchestrate the full pipeline for a projet", async () => {
      // Step 1: Mock LLM responses (3 parallel calls)
      const thResult = mockLLMResult([
        { label: "Energies renouvelables", score: 0.9 },
        { label: "Sobriété énergétique", score: 0.7 },
        { label: "Voirie", score: 0.3 },
      ]);
      const siResult = mockLLMResult([
        { label: "Ecole", score: 0.85 },
        { label: "Bâtiment public", score: 0.5 },
        { label: "Mairie", score: 0.3 },
      ]);
      const inResult = mockLLMResult([
        { label: "Rénovation bâtiment", score: 0.9 },
        { label: "Etude/Diagnostic", score: 0.6 },
        { label: "Formation", score: 0.3 },
      ]);

      mockAnthropicService.analyzeThematiques.mockResolvedValue(thResult);
      mockAnthropicService.analyzeSites.mockResolvedValue(siResult);
      mockAnthropicService.analyzeInterventions.mockResolvedValue(inResult);

      // Step 2: Mock validation (returns corrected labels as Record)
      mockValidationService.validateAndCorrect
        .mockReturnValueOnce({ "Energies renouvelables": 0.9, "Sobriété énergétique": 0.7, Voirie: 0.3 })
        .mockReturnValueOnce({ Ecole: 0.85, "Bâtiment public": 0.5, Mairie: 0.3 })
        .mockReturnValueOnce({ "Rénovation bâtiment": 0.9, "Etude/Diagnostic": 0.6, Formation: 0.3 });

      // Step 3: Mock enrichment (adds parent labels, updates scores)
      mockEnrichmentService.enrich.mockReturnValue({
        thematiques: { "Energies renouvelables": 0.9, "Sobriété énergétique": 0.7, Voirie: 0.3 },
        sites: { Ecole: 0.85, "Bâtiment public": 0.85, Mairie: 0.3 },
        interventions: { "Rénovation bâtiment": 0.9, "Etude/Diagnostic": 0.6, Formation: 0.3 },
      });

      // Step 4: Mock TE probability
      mockTEService.calculate.mockReturnValue(0.85);

      // Execute
      const result = await service.classify("Test projet - Description", "projet");

      // Verify: 3 LLM calls made in parallel
      expect(mockAnthropicService.analyzeThematiques).toHaveBeenCalledWith("Test projet - Description", "projet");
      expect(mockAnthropicService.analyzeSites).toHaveBeenCalledWith("Test projet - Description", "projet");
      expect(mockAnthropicService.analyzeInterventions).toHaveBeenCalledWith("Test projet - Description", "projet");

      // Verify: validation called for each axis with the LLM json response
      expect(mockValidationService.validateAndCorrect).toHaveBeenCalledTimes(3);
      expect(mockValidationService.validateAndCorrect).toHaveBeenCalledWith(thResult.json, "thematiques");
      expect(mockValidationService.validateAndCorrect).toHaveBeenCalledWith(siResult.json, "sites");
      expect(mockValidationService.validateAndCorrect).toHaveBeenCalledWith(inResult.json, "interventions");

      // Verify: enrichment called for projet
      expect(mockEnrichmentService.enrich).toHaveBeenCalledWith({
        thematiques: { "Energies renouvelables": 0.9, "Sobriété énergétique": 0.7, Voirie: 0.3 },
        sites: { Ecole: 0.85, "Bâtiment public": 0.5, Mairie: 0.3 },
        interventions: { "Rénovation bâtiment": 0.9, "Etude/Diagnostic": 0.6, Formation: 0.3 },
      });

      // Verify: TE probability calculated with thematiques
      expect(mockTEService.calculate).toHaveBeenCalledWith({
        "Energies renouvelables": 0.9,
        "Sobriété énergétique": 0.7,
        Voirie: 0.3,
      });

      // Verify: result filtered by default threshold 0.8 and sorted by score descending
      expect(result.projet).toBe("Test projet - Description");
      expect(result.thematiques).toEqual([{ label: "Energies renouvelables", score: 0.9 }]);
      expect(result.sites).toEqual([
        { label: "Ecole", score: 0.85 },
        { label: "Bâtiment public", score: 0.85 },
      ]);
      expect(result.interventions).toEqual([{ label: "Rénovation bâtiment", score: 0.9 }]);
      expect(result.probabiliteTE).toBe(0.85);
    });

    it("should use custom scoreThreshold when provided", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      mockValidationService.validateAndCorrect
        .mockReturnValueOnce({ "Energies renouvelables": 0.9, Voirie: 0.5 })
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      mockEnrichmentService.enrich.mockReturnValue({
        thematiques: { "Energies renouvelables": 0.9, Voirie: 0.5 },
        sites: {},
        interventions: {},
      });
      mockTEService.calculate.mockReturnValue(0.7);

      const result = await service.classify("Test", "projet", 0.4);

      // With threshold 0.4, both thematiques should be included
      expect(result.thematiques).toHaveLength(2);
      expect(result.thematiques).toEqual([
        { label: "Energies renouvelables", score: 0.9 },
        { label: "Voirie", score: 0.5 },
      ]);
    });

    it("should return empty arrays when no labels meet the threshold", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      mockValidationService.validateAndCorrect
        .mockReturnValueOnce({ Voirie: 0.3 })
        .mockReturnValueOnce({ Mairie: 0.2 })
        .mockReturnValueOnce({ Formation: 0.1 });

      mockEnrichmentService.enrich.mockReturnValue({
        thematiques: { Voirie: 0.3 },
        sites: { Mairie: 0.2 },
        interventions: { Formation: 0.1 },
      });
      mockTEService.calculate.mockReturnValue(0.1);

      const result = await service.classify("Test", "projet");

      // Default threshold 0.8 filters out everything
      expect(result.thematiques).toEqual([]);
      expect(result.sites).toEqual([]);
      expect(result.interventions).toEqual([]);
      expect(result.probabiliteTE).toBe(0.1);
    });

    it("should sort labels by score descending", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      mockValidationService.validateAndCorrect
        .mockReturnValueOnce({ A: 0.8, B: 0.95, C: 0.85 })
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      mockEnrichmentService.enrich.mockReturnValue({
        thematiques: { A: 0.8, B: 0.95, C: 0.85 },
        sites: {},
        interventions: {},
      });
      mockTEService.calculate.mockReturnValue(0.9);

      const result = await service.classify("Test", "projet");

      expect(result.thematiques).toEqual([
        { label: "B", score: 0.95 },
        { label: "C", score: 0.85 },
        { label: "A", score: 0.8 },
      ]);
    });
  });

  describe("classify - aide", () => {
    it("should skip enrichment for aides", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(
        mockLLMResult([{ label: "Energies renouvelables", score: 0.6 }]),
      );
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      mockValidationService.validateAndCorrect
        .mockReturnValueOnce({ "Energies renouvelables": 0.6 })
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      mockTEService.calculate.mockReturnValue(1.0);

      const result = await service.classify("Test aide", "aide");

      // Enrichment NOT called for aides
      expect(mockEnrichmentService.enrich).not.toHaveBeenCalled();

      // Label with 0.6 score should be included (threshold is 0 for aides)
      expect(result.thematiques).toEqual([{ label: "Energies renouvelables", score: 0.6 }]);
      expect(result.probabiliteTE).toBe(1.0);
    });

    it("should include all labels regardless of score for aides", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      mockValidationService.validateAndCorrect
        .mockReturnValueOnce({ A: 0.9, B: 0.1 })
        .mockReturnValueOnce({ C: 0.05 })
        .mockReturnValueOnce({ D: 0.3 });

      mockTEService.calculate.mockReturnValue(0.5);

      const result = await service.classify("Test aide", "aide");

      // With threshold 0, all labels with score >= 0 are included
      expect(result.thematiques).toHaveLength(2);
      expect(result.sites).toHaveLength(1);
      expect(result.interventions).toHaveLength(1);
    });

    it("should ignore custom scoreThreshold for aides", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      mockValidationService.validateAndCorrect
        .mockReturnValueOnce({ A: 0.1 })
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      mockTEService.calculate.mockReturnValue(0.5);

      // Even with high scoreThreshold, aides use threshold 0
      const result = await service.classify("Test aide", "aide", 0.95);

      expect(result.thematiques).toEqual([{ label: "A", score: 0.1 }]);
    });
  });

  describe("error handling", () => {
    it("should throw InternalServerErrorException when thematiques LLM returns an error", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue({
        json: { projet: "Test", items: [] },
        errorMessage: "API error",
      });
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      await expect(service.classify("Test", "projet")).rejects.toThrow(InternalServerErrorException);
      await expect(service.classify("Test", "projet")).rejects.toThrow("Classification error: API error");
    });

    it("should throw when sites LLM returns an error", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue({
        json: { projet: "Test", items: [] },
        errorMessage: "Rate limit exceeded",
      });
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      await expect(service.classify("Test", "projet")).rejects.toThrow("Classification error: Rate limit exceeded");
    });

    it("should throw when interventions LLM returns an error", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue({
        json: { projet: "Test", items: [] },
        errorMessage: "Timeout",
      });

      await expect(service.classify("Test", "projet")).rejects.toThrow("Classification error: Timeout");
    });

    it("should not call validation or enrichment when LLM returns an error", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue({
        json: { projet: "Test", items: [] },
        errorMessage: "Failed",
      });
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      await expect(service.classify("Test", "projet")).rejects.toThrow();

      expect(mockValidationService.validateAndCorrect).not.toHaveBeenCalled();
      expect(mockEnrichmentService.enrich).not.toHaveBeenCalled();
      expect(mockTEService.calculate).not.toHaveBeenCalled();
    });
  });

  describe("default type", () => {
    it("should default to projet type when not specified", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      mockValidationService.validateAndCorrect.mockReturnValue({});
      mockEnrichmentService.enrich.mockReturnValue({
        thematiques: {},
        sites: {},
        interventions: {},
      });
      mockTEService.calculate.mockReturnValue(null);

      await service.classify("Test");

      // Should call LLM with "projet" as default type
      expect(mockAnthropicService.analyzeThematiques).toHaveBeenCalledWith("Test", "projet");
      expect(mockAnthropicService.analyzeSites).toHaveBeenCalledWith("Test", "projet");
      expect(mockAnthropicService.analyzeInterventions).toHaveBeenCalledWith("Test", "projet");

      // Should call enrichment (projet path)
      expect(mockEnrichmentService.enrich).toHaveBeenCalled();
    });
  });

  describe("TE probability", () => {
    it("should pass enriched thematiques to TE probability calculation for projets", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      mockValidationService.validateAndCorrect
        .mockReturnValueOnce({ A: 0.9 })
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      // Enrichment adds a parent label
      mockEnrichmentService.enrich.mockReturnValue({
        thematiques: { A: 0.9, Parent: 0.9 },
        sites: {},
        interventions: {},
      });
      mockTEService.calculate.mockReturnValue(0.95);

      await service.classify("Test", "projet");

      // TE probability should receive enriched thematiques
      expect(mockTEService.calculate).toHaveBeenCalledWith({ A: 0.9, Parent: 0.9 });
    });

    it("should pass raw thematiques to TE probability calculation for aides", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      mockValidationService.validateAndCorrect
        .mockReturnValueOnce({ A: 0.9 })
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      mockTEService.calculate.mockReturnValue(0.8);

      await service.classify("Test", "aide");

      // No enrichment for aides, raw validated labels passed directly
      expect(mockTEService.calculate).toHaveBeenCalledWith({ A: 0.9 });
    });

    it("should return null probabiliteTE when calculate returns null", async () => {
      mockAnthropicService.analyzeThematiques.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeSites.mockResolvedValue(mockLLMResult([]));
      mockAnthropicService.analyzeInterventions.mockResolvedValue(mockLLMResult([]));

      mockValidationService.validateAndCorrect.mockReturnValue({});
      mockEnrichmentService.enrich.mockReturnValue({
        thematiques: {},
        sites: {},
        interventions: {},
      });
      mockTEService.calculate.mockReturnValue(null);

      const result = await service.classify("Test", "projet");

      expect(result.probabiliteTE).toBeNull();
    });
  });
});
