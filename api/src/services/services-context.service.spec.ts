import { TestingModule } from "@nestjs/testing";
import { ServicesContextService } from "./services-context.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateServiceContextRequest } from "./dto/create-service-context.dto";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { CreateServiceRequest } from "@/services/dto/create-service.dto";

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
    const servicePayload: CreateServiceRequest = {
      name: "Test Service",
      description: "Original Description",
      sousTitre: "Test Sous Titre",
      logoUrl: "https://test.com/logo.png",
      redirectionUrl: "https://test.com",
      redirectionLabel: "Original Label",
      isListed: true,
    };
    it("should return empty array when no competences , leviers and project status provided", async () => {
      const result = await serviceContextService.findMatchingServices(null, null, null);
      expect(result).toEqual([]);
    });

    it("should return matching services by competences", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        sousTitre: "Context Sous Titre",
        competences: ["Santé", "Culture > Arts plastiques et photographie"],
        logoUrl: "https://test.com/context-logo.png",
        redirectionUrl: "https://test.com/context",
        redirectionLabel: "Context Label",
        extendLabel: "Extend Label",
        status: [],
        leviers: ["Bio-carburants"],
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(["Santé"], ["Bio-carburants"], "IDEE");

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: createContextDto.description,
        sousTitre: createContextDto.sousTitre,
        logoUrl: createContextDto.logoUrl,
        redirectionUrl: createContextDto.redirectionUrl,
        redirectionLabel: createContextDto.redirectionLabel,
        extendLabel: createContextDto.extendLabel,
        iframeUrl: null,
        isListed: true,
        extraFields: [],
      });
    });

    it("should match services by project status", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["Santé"],
        leviers: [],
        status: ["IDEE"],
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(["Santé"], ["Bio-carburants"], "IDEE");

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        ...service,
        createdAt: expect.any(Date),
        description: createContextDto.description,
        isListed: true,
        extraFields: [],
      });
    });

    it("should match services by leviers", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        competences: [],
        description: "Context Description",
        leviers: ["Bio-carburants"],
        status: [],
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(["Santé"], ["Bio-carburants"], "IDEE");

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        ...service,
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: "Context Description",
        isListed: true,
        extraFields: [],
      });
    });

    it("should return original service fields when context fields are not provided", async () => {
      const service = await servicesService.create({
        ...servicePayload,
        iframeUrl: "https://test.com/iframe",
        extendLabel: "Extend Label",
      });

      const createContextDto: CreateServiceContextRequest = {
        competences: ["Santé"],
        leviers: [],
        status: [],
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(["Santé"], null, null);

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: service.description,
        sousTitre: service.sousTitre,
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: service.extendLabel,
        iframeUrl: service.iframeUrl,
        isListed: true,
        extraFields: [],
      });
    });

    it("should match competence and status when both are provided", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        sousTitre: "Context Sous Titre",
        competences: ["Santé"],
        status: ["IDEE", "FAISABILITE"],
        leviers: [],
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any competence
      const serviceContexts = await serviceContextService.findMatchingServices(
        ["Santé", "Culture > Arts plastiques et photographie"],
        null,
        "IDEE",
      );

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: "Context Description",
        sousTitre: "Context Sous Titre",
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: null,
        isListed: true,
        iframeUrl: null,
        extraFields: [],
      });

      const otherServiceContexts = await serviceContextService.findMatchingServices(["Santé"], null, null);
      expect(otherServiceContexts).toHaveLength(1);
    });

    it("should not match when status match but not the competences while being provided", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        // Empty array should match all
        competences: ["Santé"],
        status: ["IDEE", "FAISABILITE"],
        leviers: [],
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any competence
      const serviceContexts = await serviceContextService.findMatchingServices(
        ["Culture > Arts plastiques et photographie"],
        null,
        "IDEE",
      );

      expect(serviceContexts).toHaveLength(0);
    });

    it("should not match when status match but not the levier while being provided", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        // Empty array should match all
        competences: [],
        status: ["IDEE", "FAISABILITE"],
        leviers: ["Covoiturage"],
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any competence
      const serviceContexts = await serviceContextService.findMatchingServices(null, ["Bio-carburants"], "IDEE");

      expect(serviceContexts).toHaveLength(0);
    });

    it("should not match when levier/comp match but not the status", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["Santé"],
        status: ["FAISABILITE"],
        leviers: ["Covoiturage"],
      };

      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(["Santé"], ["Covoiturage"], "IDEE");

      expect(serviceContexts).toHaveLength(0);
    });

    it("should match leviers and status when both are provided", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        // Empty array should match all
        competences: [],
        status: ["IDEE", "FAISABILITE"],
        leviers: ["Bio-carburants"],
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any competence
      const serviceContexts = await serviceContextService.findMatchingServices(null, ["Bio-carburants"], "IDEE");

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: "Context Description",
        sousTitre: service.sousTitre,
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: null,
        iframeUrl: null,
        isListed: true,
        extraFields: [],
      });

      const otherServiceContexts = await serviceContextService.findMatchingServices(["Santé"], null, null);
      expect(otherServiceContexts).toHaveLength(1);
    });

    it("should match all competences when service context has empty competences array", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        // Empty array should match all
        competences: [],
        status: [],
        leviers: [],
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any competence
      const serviceContexts = await serviceContextService.findMatchingServices(
        ["Culture > Arts plastiques et photographie"],
        null,
        null,
      );

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: "Context Description",
        sousTitre: service.sousTitre,
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: null,
        iframeUrl: null,
        isListed: true,
        extraFields: [],
      });

      const otherServiceContexts = await serviceContextService.findMatchingServices(["Santé"], null, null);
      expect(otherServiceContexts).toHaveLength(1);
    });

    it("should match all leviers when service context has empty leviers array", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: [],
        status: [],
        leviers: [],
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any competence
      const serviceContexts = await serviceContextService.findMatchingServices(null, ["Bio-carburants"], null);

      expect(serviceContexts).toHaveLength(1);

      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: "Context Description",
        sousTitre: service.sousTitre,
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: null,
        iframeUrl: null,
        isListed: true,
        extraFields: [],
      });

      const otherServiceContexts = await serviceContextService.findMatchingServices(["Santé"], null, null);
      expect(otherServiceContexts).toHaveLength(1);
    });

    it("should match all status when service context has empty status array", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        // Empty array should match all
        competences: [],
        status: [],
        leviers: [],
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any competence
      const serviceContexts = await serviceContextService.findMatchingServices(null, null, "IDEE");

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: "Context Description",
        sousTitre: service.sousTitre,
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: null,
        iframeUrl: null,
        isListed: true,
        extraFields: [],
      });

      const otherServiceContexts = await serviceContextService.findMatchingServices(["Santé"], null, null);
      expect(otherServiceContexts).toHaveLength(1);
    });

    it("should not match services with different competence", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        competences: ["Action sociale (hors APA et RSA) > Citoyenneté"],
        description: "Context Description",
        leviers: [],
        status: [],
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(
        ["Culture > Arts plastiques et photographie"],
        null,
        null,
      );

      expect(serviceContexts).toHaveLength(0);
    });

    it("should not match services when targeted service is not listed", async () => {
      const service = await servicesService.create({
        ...servicePayload,
        isListed: false,
      });

      const createContextDto: CreateServiceContextRequest = {
        competences: ["Culture > Arts plastiques et photographie"],
        description: "Context Description",
        leviers: ["Bio-carburants"],
        status: [],
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServices(
        ["Culture > Arts plastiques et photographie"],
        ["Bio-carburants"],
        "IDEE",
      );

      expect(serviceContexts).toHaveLength(0);
    });
  });

  describe("create", () => {
    const validService: CreateServiceRequest = {
      name: "Test Service",
      description: "Test Description",
      sousTitre: "Test Sous Titre",
      logoUrl: "https://test.com/logo.png",
      redirectionUrl: "https://test.com",
      redirectionLabel: "Go to test service",
    };

    const validServiceContext: CreateServiceContextRequest = {
      description: "Context Description",
      sousTitre: "Context Sous Titre",
      competences: ["Santé", "Culture > Arts plastiques et photographie"],
      logoUrl: "https://test.com/context-logo.png",
      redirectionUrl: "https://test.com/context",
      leviers: ["Bio-carburants", "Covoiturage"],
      redirectionLabel: "Context Label",
      extendLabel: "Extend Label",
      status: [],
    };

    it("should create a new service context", async () => {
      const service = await servicesService.create(validService);
      const result = await serviceContextService.create(service.id, validServiceContext);

      expect(result).toEqual({
        id: result.id,
        serviceId: service.id,
        ...validServiceContext,
        iframeUrl: null,
        extraFields: [],
      });
    });

    it("should throw ConflictException when creating a service context with duplicate description for the same service", async () => {
      const service = await servicesService.create(validService);
      await serviceContextService.create(service.id, validServiceContext);

      // Try to create second service context with same description
      await expect(serviceContextService.create(service.id, validServiceContext)).rejects.toThrow(
        new ConflictException(
          `A service context with the description "${validServiceContext.description}" already exists for this service`,
        ),
      );
    });

    it("should allow same description for different services", async () => {
      const service1 = await servicesService.create(validService);
      const context1 = await serviceContextService.create(service1.id, validServiceContext);

      const service2 = await servicesService.create({
        ...validService,
        name: "Test Service 2",
      });
      const context2 = await serviceContextService.create(service2.id, validServiceContext);

      expect(context2).toBeDefined();
      expect(context2.id).not.toBe(context1.id);
    });

    it("should throw NotFoundException when service does not exist", async () => {
      await expect(serviceContextService.create(crypto.randomUUID(), validServiceContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should create a service context with extra fields", async () => {
      const service = await servicesService.create({
        name: "Test Service",
        description: "Test Description",
        sousTitre: "Test Sous Titre",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Go to test service",
      });

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        sousTitre: "Context Sous Titre",
        competences: ["Santé", "Culture > Arts plastiques et photographie"],
        logoUrl: "https://test.com/context-logo.png",
        redirectionUrl: "https://test.com/context",
        leviers: ["Bio-carburants", "Covoiturage"],
        redirectionLabel: "Context Label",
        extendLabel: "Extend Label",
        status: [],
        extraFields: [
          { name: "field1", label: "field1 label" },
          { name: "field2", label: "field2 label" },
        ],
      };

      const result = await serviceContextService.create(service.id, createContextDto);

      expect(result).toEqual({
        id: expect.any(String),
        serviceId: service.id,
        ...createContextDto,
        iframeUrl: null,
      });
    });
  });
});
