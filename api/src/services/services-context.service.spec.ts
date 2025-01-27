import { TestingModule } from "@nestjs/testing";
import { ServicesContextService } from "./services-context.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateServiceContextRequest } from "./dto/create-service-context.dto";
import { NotFoundException } from "@nestjs/common";
import { ServicesService } from "./services.service";

describe("ServiceContextService", () => {
  let serviceContextService: ServicesContextService;
  let servicesService: ServicesService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    serviceContextService = module.get<ServicesContextService>(ServicesContextService);
    servicesService = module.get<ServicesService>(ServicesService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
  });

  describe("findMatchingServices", () => {
    it("should return empty array when no competences and project status provided", async () => {
      const result = await serviceContextService.findMatchingServices(null, null, null);
      expect(result).toEqual([]);
    });

    it("should return matching services based on competences", async () => {
      const service = await servicesService.create({
        name: "Test Service",
        description: "Original Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Original Label",
      });

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
        logoUrl: "https://test.com/context-logo.png",
        redirectionUrl: "https://test.com/context",
        redirectionLabel: "Context Label",
        extendLabel: "Extend Label",
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(["Santé"], null, null);

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: serviceContexts[0].description,
        logoUrl: serviceContexts[0].logoUrl,
        redirectionUrl: serviceContexts[0].redirectionUrl,
        redirectionLabel: serviceContexts[0].redirectionLabel,
        extendLabel: serviceContexts[0].extendLabel,
        iframeUrl: serviceContexts[0].iframeUrl,
      });
    });

    it("should return original service fields when context fields are not provided", async () => {
      const service = await servicesService.create({
        name: "Test Service",
        description: "Original Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Original Label",
        iframeUrl: "https://test.com/iframe",
        extendLabel: "Extend Label",
      });

      const createContextDto: CreateServiceContextRequest = {
        competencesAndSousCompetences: ["Santé"],
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(["Santé"], null, null);

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: service.description,
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: service.extendLabel,
        iframeUrl: service.iframeUrl,
      });
    });

    it("should match services by exact sous competence", async () => {
      const service = await servicesService.create({
        name: "Test Service",
        description: "Original Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Original Label",
      });

      const createContextDto: CreateServiceContextRequest = {
        competencesAndSousCompetences: ["Culture__Arts plastiques et photographie"],
        description: "Context Description",
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(
        ["Culture"],
        ["Arts plastiques et photographie"],
        null,
      );

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: "Context Description",
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: service.extendLabel,
        iframeUrl: service.iframeUrl,
      });
    });

    it("should not match services with different sous competence and competence", async () => {
      const service = await servicesService.create({
        name: "Test Service",
        description: "Original Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Original Label",
      });

      const createContextDto: CreateServiceContextRequest = {
        competencesAndSousCompetences: ["Action sociale (hors APA et RSA)__Citoyenneté"],
        description: "Context Description",
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(
        ["Culture"],
        ["Bibliothèques et livres"],
        null,
      );

      expect(serviceContexts).toHaveLength(0);
    });

    it("should fall back to base competence when no sous competence matches", async () => {
      const service = await servicesService.create({
        name: "Test Service",
        description: "Original Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Original Label",
      });

      const createContextDto: CreateServiceContextRequest = {
        competencesAndSousCompetences: ["Culture__Arts plastiques et photographie"],
        description: "Context Description",
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(["Culture"], null, null);

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0].id).toBe(service.id);
    });

    it("should match all competences when service context has empty competences array", async () => {
      const service = await servicesService.create({
        name: "Test Service",
        description: "Original Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Original Label",
      });

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competencesAndSousCompetences: [], // Empty array should match all
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any competence
      const serviceContexts = await serviceContextService.findMatchingServices(
        ["Culture"],
        ["Arts plastiques et photographie"],
        null,
      );

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: "Context Description",
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: null,
        iframeUrl: null,
      });

      const otherServiceContexts = await serviceContextService.findMatchingServices(["Santé"], null, null);
      expect(otherServiceContexts).toHaveLength(1);
    });
  });

  describe("create", () => {
    it("should create a new service context", async () => {
      // Create a test service first
      const service = await servicesService.create({
        name: "Test Service",
        description: "Test Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Go to test service",
      });

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
        logoUrl: "https://test.com/context-logo.png",
        redirectionUrl: "https://test.com/context",
        redirectionLabel: "Context Label",
        extendLabel: "Extend Label",
      };

      const result = await serviceContextService.create(service.id, createContextDto);

      expect(result).toEqual({
        id: result.id,
        serviceId: service.id,
        description: "Context Description",
        competences: ["Santé", "Culture"],
        sousCompetences: ["Arts plastiques et photographie"],
        logoUrl: "https://test.com/context-logo.png",
        redirectionUrl: "https://test.com/context",
        redirectionLabel: "Context Label",
        extendLabel: "Extend Label",
        statuses: [],
        iframeUrl: null,
      });
    });

    it("should throw NotFoundException when service does not exist", async () => {
      const createContextDto: CreateServiceContextRequest = {
        competencesAndSousCompetences: ["Santé"],
      };

      await expect(serviceContextService.create(crypto.randomUUID(), createContextDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
