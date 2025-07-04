import { createApiClient } from "./helpers/api-client";
import { CreateServiceContextRequest } from "@/services/dto/create-service-context.dto";

describe("Services (e2e)", () => {
  const serviceManagementApi = createApiClient(process.env.SERVICE_MANAGEMENT_API_KEY!);
  const regularApi = createApiClient(process.env.MEC_API_KEY!);

  const validService = {
    name: "Test Service",
    description: "Test Description",
    sousTitre: "Test sous-titre",
    logoUrl: "https://test.com/logo.png",
    redirectionUrl: "https://test.com",
    redirectionLabel: "Go to test service",
  };

  describe("POST /services", () => {
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
    const validServiceContext: CreateServiceContextRequest = {
      description: "Context Description",
      logoUrl: "https://test.com/logo.png",
      redirectionUrl: "https://test.com",
      redirectionLabel: "Go to test service",
      extendLabel: "Extend Label",
      competences: ["90-11"],
      leviers: [],
      extraFields: [{ name: "surface", label: "Surface en m2" }],
      phases: [],
      regions: [],
    };

    it("should reject when using regular API key", async () => {
      const { data } = await serviceManagementApi.services.create({
        ...validService,
        name: "regular api key service",
      });
      const { error } = await regularApi.services.createContext(data!.id, validServiceContext);

      expect(error?.statusCode).toBe(401);
      expect(error?.message).toContain("Invalid service management API key");
    });

    it("should create service context with service management API key", async () => {
      const { data: serviceData } = await serviceManagementApi.services.create({
        ...validService,
        name: "Test 3 name",
      });
      const { data, error } = await serviceManagementApi.services.createContext(serviceData!.id, validServiceContext);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: expect.any(String),
        serviceId: serviceData!.id,
        description: "Context Description",
        competences: ["90-11"],
        extraFields: [{ name: "surface", label: "Surface en m2" }],
      });
    });

    it("should create service context with null values for matching criteria", async () => {
      const { data: serviceData } = await serviceManagementApi.services.create({
        ...validService,
        name: "null value matching criteria service",
      });

      const { data, error } = await serviceManagementApi.services.createContext(serviceData!.id, {
        description: "Context Description",
        competences: null,
        leviers: null,
        phases: null,
        regions: [],
      });

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: expect.any(String),
        competences: null,
        leviers: null,
        phases: null,
      });
    });
  });
});
