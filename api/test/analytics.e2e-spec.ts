import { createApiClient } from "@test/helpers/api-client";
import { mockedDefaultCollectivite } from "@test/mocks/mockProjetPayload";
import { apiRequests, collectivites } from "@database/schema";
import { CreateProjetRequest } from "@projets/dto/create-projet.dto";
import { eq } from "drizzle-orm";

describe("Analytics (e2e)", () => {
  const api = createApiClient(process.env.MEC_API_KEY);

  afterEach(async () => {
    await global.testDbService.cleanDatabase();
  });

  beforeEach(async () => {
    // Set up a collectivité for our tests
    await global.testDbService.database.insert(collectivites).values({
      type: mockedDefaultCollectivite.type,
      codeInsee: mockedDefaultCollectivite.code,
      nom: "Commune Test Analytics",
    });
  });

  describe("@TrackApiUsage decorator", () => {
    it("should record API request when calling GET /projets", async () => {
      const initialRequests = await global.testDbService.database.select().from(apiRequests);
      expect(initialRequests).toHaveLength(0);

      // Make a request to the tracked endpoint
      await api.projets.getAll();

      const recordedRequests = await global.testDbService.database.select().from(apiRequests);
      expect(recordedRequests).toHaveLength(1);

      const request = recordedRequests[0];

      expect(request).toEqual({
        id: request.id,
        method: "GET",
        endpoint: "/projets",
        fullUrl: "/projets",
        statusCode: 200,
        responseTimeInMs: expect.any(Number),
        serviceName: "MEC",
        createdAt: expect.any(Date),
      });
    });

    it("should record API request when calling GET /projets/:id", async () => {
      const minimalProjet: CreateProjetRequest = {
        nom: "Test Projet Analytics",
        description: "Test Description",
        externalId: "test-analytics-id",
        collectivites: [{ type: mockedDefaultCollectivite.type, code: mockedDefaultCollectivite.code }],
      };

      const { data: createdProjet } = await api.projets.create(minimalProjet);

      await api.projets.getOne(createdProjet!.id);

      const recordedRequests = await global.testDbService.database
        .select()
        .from(apiRequests)
        .where(eq(apiRequests.fullUrl, `/projets/${createdProjet!.id}`));

      const recordedRequest = recordedRequests[0];

      expect(recordedRequest).toEqual({
        id: recordedRequest.id,
        method: "GET",
        endpoint: "/projets/:id",
        fullUrl: `/projets/${createdProjet!.id}`,
        statusCode: 200,
        responseTimeInMs: expect.any(Number),
        serviceName: "MEC",
        createdAt: expect.any(Date),
      });
    });

    it("should NOT record API request for non-tracked endpoints", async () => {
      await api.analytics.getWidgetUsage();

      const recordedRequests = await global.testDbService.database.select().from(apiRequests);
      expect(recordedRequests).toHaveLength(0);
    });
  });
});
