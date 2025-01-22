// disabled to use expect any syntax
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { TestingModule } from "@nestjs/testing";
import { ServiceContextService } from "./service-context.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { CreateServiceContextRequest } from "./dto/create-service-context.dto";
import { NotFoundException } from "@nestjs/common";
import { ServicesService } from "./services.service";

describe("ServiceContextService", () => {
  let serviceContextService: ServiceContextService;
  let servicesService: ServicesService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    serviceContextService = module.get<ServiceContextService>(ServiceContextService);
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
      const result = await serviceContextService.findMatchingServices(null, null);
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
        serviceId: service.id,
        description: "Context Description",
        competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
        logoUrl: "https://test.com/context-logo.png",
        redirectionUrl: "https://test.com/context",
        redirectionLabel: "Context Label",
        extendLabel: "Extend Label",
      };
      await serviceContextService.create(createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(["Santé"], null);

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
      });
    });

    it("should return original service fields when context fields are not provided", async () => {
      const service = await servicesService.create({
        name: "Test Service",
        description: "Original Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Original Label",
      });

      const createContextDto: CreateServiceContextRequest = {
        serviceId: service.id,
        competencesAndSousCompetences: ["Santé"],
      };
      await serviceContextService.create(createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(["Santé"], null);

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: service.description,
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: null,
      });
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
        serviceId: service.id,
        description: "Context Description",
        competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
        logoUrl: "https://test.com/context-logo.png",
        redirectionUrl: "https://test.com/context",
        redirectionLabel: "Context Label",
        extendLabel: "Extend Label",
      };

      const result = await serviceContextService.create(createContextDto);

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
        statuses: null,
      });
    });

    it("should throw NotFoundException when service does not exist", async () => {
      const createContextDto: CreateServiceContextRequest = {
        serviceId: crypto.randomUUID(),
        competencesAndSousCompetences: ["Santé"],
      };

      await expect(serviceContextService.create(createContextDto)).rejects.toThrow(NotFoundException);
    });
  });
});
