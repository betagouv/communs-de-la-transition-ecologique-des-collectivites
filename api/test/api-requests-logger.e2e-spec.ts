import { eq } from "drizzle-orm";
import { E2E_BASE_URL } from "@test/helpers/e2e-port";
import { mockedDefaultCollectivite } from "@test/mocks/mockProjetPayload";
import { apiRequests, collectivites } from "@database/schema";

describe("API requests logger (e2e)", () => {
  beforeEach(async () => {
    await global.testDbService.cleanDatabase();
    await global.testDbService.database.insert(collectivites).values({
      type: mockedDefaultCollectivite.type,
      codeInsee: mockedDefaultCollectivite.code,
      nom: "Commune 1",
    });
  });

  afterAll(async () => {
    await global.testDbService.cleanDatabase();
  }, 10000);

  // The interceptor persists api_requests without awaiting the insert, so we poll briefly.
  const findApiRequestsByEndpoint = async (endpoint: string, timeoutMs = 2000) => {
    const deadline = Date.now() + timeoutMs;
    let rows = await global.testDbService.database.select().from(apiRequests).where(eq(apiRequests.endpoint, endpoint));
    while (rows.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      rows = await global.testDbService.database.select().from(apiRequests).where(eq(apiRequests.endpoint, endpoint));
    }
    return rows;
  };

  it("should create an api_request record with the route pattern for a nested path", async () => {
    // The TeT routes are not exposed by the typed api client, so we call them directly.
    const headers = {
      Authorization: `Bearer ${process.env.TET_API_KEY}`,
      "Content-Type": "application/json",
    };
    const createResponse = await fetch(`${E2E_BASE_URL}/tet/v1/actions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        nom: "Fiche action test",
        externalId: "api-requests-logger-1",
        collectivites: [mockedDefaultCollectivite],
      }),
    });
    expect(createResponse.status).toBe(201);
    const { id: ficheActionId } = (await createResponse.json()) as { id: string };

    const response = await fetch(`${E2E_BASE_URL}/tet/v1/actions/${ficheActionId}/secteurs`, { headers });

    expect(response.status).toBe(200);

    const records = await findApiRequestsByEndpoint("/tet/v1/actions/:id/secteurs");

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      method: "GET",
      endpoint: "/tet/v1/actions/:id/secteurs",
      fullUrl: `/tet/v1/actions/${ficheActionId}/secteurs`,
      statusCode: 200,
    });
  });
});
