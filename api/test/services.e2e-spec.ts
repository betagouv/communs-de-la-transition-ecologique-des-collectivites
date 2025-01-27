import { createApiClient } from "./helpers/api-client";
import { CreateServiceContextRequest } from "@/services/dto/create-service-context.dto";

describe("Services (e2e)", () => {
  const serviceManagementApi = createApiClient(process.env.SERVICE_MANAGEMENT_API_KEY!);
  const regularApi = createApiClient(process.env.MEC_API_KEY!);

  describe("POST /services", () => {
    const validService = {
      name: "Test Service",
      description: "Test Description",
      logoUrl: "https://test.com/logo.png",
      redirectionUrl: "https://test.com",
      redirectionLabel: "Go to test service",
    };

    it("should reject when using regular API key", async () => {
      const { error } = await regularApi.services.create(validService);

      expect(error?.statusCode).toBe(401);
      expect(error?.message).toContain("Invalid service management API key");
    });

    it("should create service with service management API key", async () => {
      const { data, error } = await serviceManagementApi.services.create(validService);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: expect.any(String),
        ...validService,
      });
    });
  });

  describe("POST /services/contexts", () => {
    let serviceId: string;

    beforeEach(async () => {
      const { data } = await serviceManagementApi.services.create({
        name: "Context Test Service",
        description: "Test Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Go to test service",
      });
      serviceId = data!.id;
    });

    const validServiceContext: CreateServiceContextRequest = {
      competencesAndSousCompetences: ["Santé"],
      description: "Context Description",
      logoUrl: "https://test.com/logo.png",
      redirectionUrl: "https://test.com",
      redirectionLabel: "Go to test service",
      extendLabel: "Extend Label",
    };

    it("should reject when using regular API key", async () => {
      const { error } = await regularApi.services.createContext(serviceId, validServiceContext);

      expect(error?.statusCode).toBe(401);
      expect(error?.message).toContain("Invalid service management API key");
    });

    it("should create service context with service management API key", async () => {
      const { data, error } = await serviceManagementApi.services.createContext(serviceId, validServiceContext);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: expect.any(String),
        serviceId,
        description: "Context Description",
        competences: ["Santé"],
        sousCompetences: [],
      });
    });
  });
});
