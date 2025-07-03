import { createApiClient } from "./helpers/api-client";
import { CreateServiceContextRequest } from "@/services/dto/create-service-context.dto";
import { CompetenceCodes, Leviers } from "@/shared/types";
import { ProjetPhase } from "@database/schema";

describe("Services (e2e)", () => {
  const serviceManagementApi = createApiClient(process.env.SERVICE_MANAGEMENT_API_KEY);
  const regularApi = createApiClient(process.env.MEC_API_KEY);

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

  describe("GET /services/search/context", () => {
    let testServiceId: string;
    const clientPublicApi = createApiClient();

    beforeAll(async () => {
      const { data: serviceData } = await serviceManagementApi.services.create({
        ...validService,
        name: "Context Test Service",
      });
      testServiceId = serviceData!.id;

      const testContext: CreateServiceContextRequest = {
        description: "Test Context Description",
        competences: ["90-411", "90-311"],
        leviers: ["Bio-carburants", "Covoiturage"],
        phases: ["Idée", "Étude"],
        regions: [],
      };

      await serviceManagementApi.services.createContext(testServiceId, testContext);
    });

    it("should reject when wrong competences code", async () => {
      const { error } = await clientPublicApi.services.getByContext({
        competences: ["90-411", "90-10000"] as CompetenceCodes,
        phases: [],
      });

      expect(error).toBeDefined();
      expect(error?.statusCode).toBe(400);
    });

    it("should return services when valid leviers are provided", async () => {
      const { data, error } = await regularApi.services.getByContext({
        leviers: ["Bio-carburants", "Covoiturage"] as Leviers,
        phases: [],
      });

      expect(error).toBeUndefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThan(0);
    });

    it("should return services when valid phases are provided", async () => {
      const { data, error } = await regularApi.services.getByContext({
        phases: ["Idée", "Étude"] as ProjetPhase[],
      });

      expect(error).toBeUndefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it("should return services when competences and leviers are provided", async () => {
      const { data, error } = await regularApi.services.getByContext({
        competences: ["90-411"] as CompetenceCodes,
        leviers: ["Bio-carburants"] as Leviers,
        phases: [],
      });

      expect(error).toBeUndefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it("should return empty array when no matching criteria", async () => {
      const { data, error } = await regularApi.services.getByContext({
        competences: ["90-999"] as any, // Compétence inexistante
        phases: [],
      });

      expect(error).toBeUndefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBe(0);
    });

    it("should reject when no criteria provided", async () => {
      const { error } = await regularApi.services.getByContext({
        phases: [],
      });

      expect(error).toBeDefined();
      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("At least one of competences or leviers must be provided");
    });

    it("should reject when invalid competence code is provided", async () => {
      const { error } = await regularApi.services.getByContext({
        competences: ["invalid-code"] as any,
        phases: [],
      });

      expect(error).toBeDefined();
      expect(error?.statusCode).toBe(400);
    });

    it("should reject when invalid levier is provided", async () => {
      const { error } = await regularApi.services.getByContext({
        leviers: ["Invalid-Levier"] as any,
        phases: [],
      });

      expect(error).toBeDefined();
      expect(error?.statusCode).toBe(400);
    });

    it("should reject when invalid phase is provided", async () => {
      const { error } = await regularApi.services.getByContext({
        phases: ["Invalid-Phase"] as any,
      });

      expect(error).toBeDefined();
      expect(error?.statusCode).toBe(400);
    });

    it("should handle empty arrays gracefully", async () => {
      const { error } = await regularApi.services.getByContext({
        competences: [],
        leviers: [],
        phases: [],
      });

      expect(error).toBeDefined();
      expect(error?.statusCode).toBe(400);
    });

    it("should handle single values correctly", async () => {
      const { data, error } = await regularApi.services.getByContext({
        competences: ["90-411"] as CompetenceCodes,
        phases: [],
      });

      expect(error).toBeUndefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it("should handle multiple values correctly", async () => {
      const { data, error } = await regularApi.services.getByContext({
        competences: ["90-411", "90-311"] as CompetenceCodes,
        phases: [],
      });

      expect(error).toBeUndefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it("should validate that competences must be valid codes", async () => {
      const { error } = await regularApi.services.getByContext({
        competences: ["not-a-valid-code"] as any,
        phases: [],
      });

      expect(error).toBeDefined();
    });

    it("should validate that leviers must be valid", async () => {
      const { error } = await regularApi.services.getByContext({
        leviers: ["not-a-valid-levier"] as any,
        phases: [],
      });

      expect(error).toBeDefined();
    });

    it("should validate that phases must be valid", async () => {
      const { error } = await regularApi.services.getByContext({
        phases: ["not-a-valid-phase"] as any,
      });

      expect(error).toBeDefined();
    });
  });
});
