import { createApiClient } from "./helpers/api-client";
import { CreateServiceContextRequest } from "@/services/dto/create-service-context.dto";
import { CompetenceCode, Levier, Leviers } from "@/shared/types";
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

      const serviceContextOne: CreateServiceContextRequest = {
        description: "serviceContextOne Description",
        competences: ["90-411", "90-311"],
        leviers: ["Bio-carburants", "Covoiturage"],
        phases: ["Idée", "Étude"],
        regions: [],
      };

      const serviceContextTwo: CreateServiceContextRequest = {
        description: "serviceContextTwo Description",
        competences: ["90-71", "90-72"],
        leviers: ["Surface en aire protégée"],
        phases: ["Idée", "Étude", "Opération"],
        regions: [],
      };

      await serviceManagementApi.services.createContext(testServiceId, serviceContextOne);
      await serviceManagementApi.services.createContext(testServiceId, serviceContextTwo);
    });

    it("should return all services", async () => {
      const { data } = await regularApi.services.getByContext({
        leviers: [],
        competences: [],
        phases: ["Étude", "Opération", "Idée"],
      });

      expect(data!.length).toBe(2);
    });

    it("should return services with corresponding phases", async () => {
      const { data, error } = await regularApi.services.getByContext({
        phases: ["Opération"],
        competences: [],
      });

      expect(error).toBeUndefined();
      expect(data!.length).toBe(1);
      expect(data![0].description).toBe("serviceContextTwo Description");
    });

    it("should return services with corresponding leviers", async () => {
      const { data, error } = await regularApi.services.getByContext({
        leviers: ["Bio-carburants"] as Leviers,
        phases: ["Étude", "Opération", "Idée"],
      });

      expect(error).toBeUndefined();
      expect(data!.length).toBe(1);
      expect(data![0].description).toBe("serviceContextOne Description");
    });

    it("should return services with corresponding competences", async () => {
      const { data, error } = await regularApi.services.getByContext({
        competences: ["90-71"],
        phases: ["Étude", "Opération", "Idée"],
      });

      expect(error).toBeUndefined();
      expect(data!.length).toBe(1);
      expect(data![0].description).toBe("serviceContextTwo Description");
    });

    it("should return empty array when no matching criteria", async () => {
      const { data, error } = await regularApi.services.getByContext({
        competences: ["90-314"],
        leviers: ["Bio-carburants"],
        phases: ["Étude", "Opération", "Idée"],
      });

      expect(error).toBeUndefined();
      expect(data!.length).toBe(0);
    });

    it("should reject when invalid competences code", async () => {
      const { error } = await clientPublicApi.services.getByContext({
        competences: ["90-10000" as CompetenceCode],
        phases: ["Étude", "Opération", "Idée"],
        leviers: [],
      });

      expect(error).toBeDefined();
      expect(error?.statusCode).toBe(400);
    });

    it("should reject when invalid levier is provided", async () => {
      const { error } = await regularApi.services.getByContext({
        leviers: ["Invalid-Levier" as Levier],
        competences: [],
        phases: ["Étude", "Opération", "Idée"],
      });

      expect(error).toBeDefined();
      expect(error?.statusCode).toBe(400);
    });

    it("should reject when invalid phase is provided", async () => {
      const { error } = await regularApi.services.getByContext({
        phases: ["Invalid-Phase" as ProjetPhase],
        competences: [],
        leviers: [],
      });

      expect(error).toBeDefined();
      expect(error?.statusCode).toBe(400);
    });
  });
});
