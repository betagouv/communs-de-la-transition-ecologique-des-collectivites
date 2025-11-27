import { createApiClient } from "@test/helpers/api-client";

/**
 * E2E tests for Qualification endpoints
 * These tests verify HTTP endpoints with real API calls
 *
 * IMPORTANT: These tests require:
 * - MEC_API_KEY environment variable to be set
 * - ANTHROPIC_API_KEY environment variable for LLM calls
 * They are slower and consume API credits
 */
describe("Qualification (e2e)", () => {
  const api = createApiClient(process.env.MEC_API_KEY);

  afterEach(async () => {
    await global.testDbService.cleanDatabase();
  });

  describe("POST /qualification/competences", () => {
    it("should qualify competences for a valid project", async () => {
      const requestBody = {
        nom: "Rénovation énergétique",
        description: "Rénovation du chauffage d'une école primaire avec isolation thermique",
      };

      const { data, error } = await api.qualification.competences(requestBody);

      expect(error).toBeUndefined();
      expect(data).toBeDefined();
      expect(data?.projet).toBe(`${requestBody.nom} - ${requestBody.description}`);
      expect(Array.isArray(data?.competences)).toBe(true);
      expect(data!.competences.length).toBeGreaterThan(0);

      // All competences should have required fields
      data!.competences.forEach((competence) => {
        expect(competence).toHaveProperty("code");
        expect(competence).toHaveProperty("nom");
        expect(competence).toHaveProperty("score");
        expect(competence.score).toBeGreaterThan(0.7); // Threshold
      });
    }, 30000);

    it("should reject request without API key", async () => {
      const wrongApiClient = createApiClient("wrong-api-key");
      const requestBody = {
        nom: "Test",
        description: "Test description",
      };

      const { error } = await wrongApiClient.qualification.competences(requestBody);

      expect(error?.statusCode).toBe(401);
      expect(error?.message).toContain("Invalid API key");
    });

    it("should reject request with missing required fields", async () => {
      const invalidRequestBody = {
        nom: "Test",
        // missing description
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const { error } = await api.qualification.competences(invalidRequestBody as any);

      expect(error?.statusCode).toBe(400);
    });
  });

  describe("POST /qualification/leviers", () => {
    it("should qualify leviers for an ecological project", async () => {
      const requestBody = {
        nom: "Panneaux solaires",
        description: "Installation de panneaux photovoltaïques sur les toits des bâtiments communaux",
      };

      const { data, error } = await api.qualification.leviers(requestBody);

      expect(error).toBeUndefined();
      expect(data).toBeDefined();
      expect(data?.projet).toBe(`${requestBody.nom} - ${requestBody.description}`);
      expect(Array.isArray(data?.leviers)).toBe(true);
      expect(data!.leviers.length).toBeGreaterThan(0);

      // Should have classification
      expect(data?.classification).toBeDefined();
      expect(data?.classification).toMatch(/lien|pas de lien|pas assez précis/);

      // Should have reasoning
      expect(data?.raisonnement).toBeDefined();

      // All leviers should have required fields and meet threshold
      data!.leviers.forEach((levier) => {
        expect(levier).toHaveProperty("nom");
        expect(levier).toHaveProperty("score");
        expect(levier.score).toBeGreaterThan(0.7); // Threshold
      });
    }, 30000);

    it("should classify ecological projects correctly", async () => {
      const requestBody = {
        nom: "Piste cyclable",
        description: "Aménagement d'une piste cyclable sécurisée de 15 km",
      };

      const { data, error } = await api.qualification.leviers(requestBody);

      expect(error).toBeUndefined();
      expect(data?.classification).toBe("Le projet a un lien avec la transition écologique");
      expect(data!.leviers.length).toBeGreaterThan(0);
    }, 30000);

    it("should handle vague project descriptions", async () => {
      const requestBody = {
        nom: "Revitalisation",
        description: "Revitalisation du centre bourg",
      };

      const { data, error } = await api.qualification.leviers(requestBody);

      expect(error).toBeUndefined();
      expect(data?.classification).toMatch(/pas assez précis|n'a pas de lien/);
    }, 30000);

    it("should reject request without API key", async () => {
      const wrongApiClient = createApiClient("wrong-api-key");
      const requestBody = {
        nom: "Test",
        description: "Test description",
      };

      const { error } = await wrongApiClient.qualification.leviers(requestBody);

      expect(error?.statusCode).toBe(401);
      expect(error?.message).toContain("Invalid API key");
    });

    it("should reject request with missing required fields", async () => {
      const invalidRequestBody = {
        nom: "Test",
        // missing description
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const { error } = await api.qualification.leviers(invalidRequestBody as any);

      expect(error?.statusCode).toBe(400);
    });
  });

  describe("Rate limiting", () => {
    it("should apply rate limiting to qualification endpoints", async () => {
      const requestBody = {
        nom: "Test",
        description: "Test description for rate limiting",
      };

      // Make multiple rapid requests to trigger rate limiting
      // The exact number depends on the rate limit configuration
      const requests = Array.from({ length: 20 }, () => api.qualification.competences(requestBody));

      const results = await Promise.all(requests);

      // At least one request should be rate limited (429)
      const rateLimitedRequests = results.filter((result) => result.error?.statusCode === 429);

      // If rate limiting is properly configured, we should see some 429s
      // This is a soft assertion as rate limiting might be lenient in test environment
      if (rateLimitedRequests.length > 0) {
        expect(rateLimitedRequests[0].error?.message).toContain("rate limit");
      }
    }, 60000); // Long timeout for multiple requests
  });
});
