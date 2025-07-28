import { TestingModule } from "@nestjs/testing";
import { ServicesContextService } from "./services-context.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateServiceContextRequest } from "./dto/create-service-context.dto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { CreateServiceRequest } from "@/services/dto/create-service.dto";
import { ILE_DE_FRANCE_REGION_CODE, VAL_DE_LOIRE_REGION_CODE } from "@test/mocks/mockCollectivites";

describe("ServiceContextService", () => {
  let serviceContextService: ServicesContextService;
  let servicesService: ServicesService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  // Mock collectivites data for testing

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
    it("should return empty array when no competences , leviers and project phases provided", async () => {
      const result = await serviceContextService.findMatchingServicesContext(null, null, null, [
        ILE_DE_FRANCE_REGION_CODE,
      ]);
      expect(result).toEqual([]);
    });

    it("should return matching services by competences", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        sousTitre: "Context Sous Titre",
        competences: ["90-411"],
        logoUrl: "https://test.com/context-logo.png",
        redirectionUrl: "https://test.com/context",
        redirectionLabel: "Context Label",
        extendLabel: "Extend Label",
        phases: [],
        leviers: ["Bio-carburants"],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-411"],
        ["Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

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

    it("should match services by phases", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-411"],
        leviers: [],
        phases: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-411"],
        ["Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

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
        phases: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-411"],
        ["Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

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
        competences: ["90-411"],
        leviers: [],
        phases: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-411", "90-311"],
        null,
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

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

    it("should return service context fields over service fields when  provided", async () => {
      const service = await servicesService.create({
        ...servicePayload,
        iframeUrl: "https://test.com/iframe",
        extendLabel: "Extend Label",
      });

      const createContextDto: CreateServiceContextRequest = {
        competences: ["90-411"],
        leviers: [],
        phases: [],
        description: "Context Description",
        sousTitre: "Context Sous Titre",
        logoUrl: "Context Logo Url",
        redirectionUrl: "Context Redirection Url",
        redirectionLabel: "Context Redirection Label",
        extendLabel: "Context Extend Label",
        iframeUrl: "Context IFrame Url",
        name: "Context Name",
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-411", "90-311"],
        null,
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: createContextDto.name,
        description: createContextDto.description,
        sousTitre: createContextDto.sousTitre,
        logoUrl: createContextDto.logoUrl,
        redirectionUrl: createContextDto.redirectionUrl,
        redirectionLabel: createContextDto.redirectionLabel,
        extendLabel: createContextDto.extendLabel,
        iframeUrl: createContextDto.iframeUrl,
        isListed: true,
        extraFields: [],
      });
    });

    it("should match competence and phases when both are provided", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        sousTitre: "Context Sous Titre",
        competences: ["90-411"],
        phases: [],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-411", "90-311"],
        null,
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
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

      const otherServiceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);
      expect(otherServiceContexts).toHaveLength(1);
    });

    it("should not match when phases match but not the competences while being provided", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-311"],
        phases: ["Idée"],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(0);
    });

    it("should not match when phases match but not the levier while being provided", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",

        competences: [], // Empty array should match all
        phases: ["Idée"],
        leviers: ["Covoiturage"],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any competence
      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        null,
        ["Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

      expect(serviceContexts).toHaveLength(0);
    });

    it("should not match when levier/comp match but not the phases", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        // Empty array should match all
        competences: [],
        phases: ["Étude"],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any competence
      const serviceContexts = await serviceContextService.findMatchingServicesContext(null, null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(0);
    });

    it("should match leviers and phases when both are provided", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        // Empty array should match all
        competences: [],
        phases: ["Idée"],
        leviers: ["Bio-carburants"],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        null,
        ["Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
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

      const otherServiceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);
      expect(otherServiceContexts).toHaveLength(1);
    });

    it("should match all competences when service context has empty competences array", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        // Empty array should match all
        competences: [],
        phases: ["Idée"],
        leviers: null,
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-411", "90-311"],
        null,
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
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
    });

    it("should match all leviers when service context has empty leviers array", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: null,
        phases: ["Idée"],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        null,
        ["Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
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
    });

    it("should match all phases when service context has empty phase array", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        // Empty array should match all
        competences: [],
        phases: [],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-41"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

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

      const otherServiceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);
      expect(otherServiceContexts).toHaveLength(1);
    });

    it("should not match services with different competence", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        competences: ["90-11"],
        description: "Context Description",
        phases: ["Idée"],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, null, [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(0);
    });

    it("should not match services when targeted service is not listed", async () => {
      const service = await servicesService.create({
        ...servicePayload,
        isListed: false,
      });

      const createContextDto: CreateServiceContextRequest = {
        competences: ["90-411"],
        description: "Context Description",
        phases: ["Idée"],
        leviers: ["Bio-carburants"],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-411"],
        ["Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

      expect(serviceContexts).toHaveLength(0);
    });

    it("should not match services when targeted service context is not listed", async () => {
      const service = await servicesService.create({
        ...servicePayload,
      });

      const createContextDto: CreateServiceContextRequest = {
        competences: ["90-411"],
        description: "Context Description",
        phases: ["Idée"],
        leviers: ["Bio-carburants"],
        regions: [],
        isListed: false,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-411"],
        ["Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

      expect(serviceContexts).toHaveLength(0);
    });

    it("should match services by project phase", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-411"],
        phases: ["Idée"],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-411"],
        ["Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        ...service,
        createdAt: expect.any(Date),
        description: createContextDto.description,
        isListed: true,
        extraFields: [],
      });
    });

    it("should match all phase when service context has empty phase array", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        // Empty array should match all
        competences: [],
        phases: [],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      // Should match any etape
      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-41"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

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
    });

    it("should not take into account competence when there is no associated competence to the service", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: null,
        phases: [],
        leviers: [],
        regions: [],
        isListed: true,
      };

      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, null, [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(0);
    });

    it("should not take into account phase when there is no associated phase to the service", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: [],
        phases: null,
        leviers: [],
        regions: [],
        isListed: true,
      };

      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(null, null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(0);
    });

    it("should not take into account levier when there is no associated levier to the service", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: [],
        phases: [],
        leviers: null,
        regions: [],
        isListed: true,
      };

      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(null, ["Bio-carburants"], null, [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(0);
    });

    it("should allow other criteria to be matched when phase is null", async () => {
      const service1 = await servicesService.create({ ...servicePayload, name: "UrbanVitaliz" });
      const service2 = await servicesService.create({ ...servicePayload, name: "Expertises-Territoires" });

      const createContextDto1: CreateServiceContextRequest = {
        description: "UrbanVitaliz Context Description",
        competences: null,
        phases: null,
        leviers: ["Bio-carburants"],
        regions: [],
        isListed: true,
      };

      const createContextDto2: CreateServiceContextRequest = {
        description: "Expertises-Territoires Context Description",
        competences: ["90-518"],
        phases: null,
        leviers: null,
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service1.id, createContextDto1);
      await serviceContextService.create(service2.id, createContextDto2);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-51", "90-518"],
        ["Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

      expect(serviceContexts).toHaveLength(2);
    });

    it("should allow other criteria to be matched when levier is null", async () => {
      const service1 = await servicesService.create({ ...servicePayload, name: "UrbanVitaliz" });
      const service2 = await servicesService.create({ ...servicePayload, name: "Expertises-Territoires" });

      const createContextDto1: CreateServiceContextRequest = {
        description: "UrbanVitaliz Context Description",
        competences: ["90-518"],
        phases: null,
        leviers: null,
        regions: [],
        isListed: true,
      };

      const createContextDto2: CreateServiceContextRequest = {
        description: "Expertises-Territoires Context Description",
        competences: ["90-41"],
        phases: null,
        leviers: null,
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service1.id, createContextDto1);
      await serviceContextService.create(service2.id, createContextDto2);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-41", "90-518"],
        null,
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

      expect(serviceContexts).toHaveLength(2);
    });

    it("should allow other criteria to be matched when competences is null", async () => {
      const service1 = await servicesService.create({ ...servicePayload, name: "UrbanVitaliz" });
      const service2 = await servicesService.create({ ...servicePayload, name: "Expertises-Territoires" });

      const createContextDto1: CreateServiceContextRequest = {
        description: "UrbanVitaliz Context Description",
        competences: null,
        phases: null,
        leviers: ["Bio-carburants"],
        regions: [],
        isListed: true,
      };

      const createContextDto2: CreateServiceContextRequest = {
        description: "Expertises-Territoires Context Description",
        competences: null,
        phases: null,
        leviers: ["Covoiturage"],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service1.id, createContextDto1);
      await serviceContextService.create(service2.id, createContextDto2);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        null,
        ["Covoiturage", "Bio-carburants"],
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

      expect(serviceContexts).toHaveLength(2);
    });

    it("should not match null value", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: null,
        phases: null,
        leviers: null,
        regions: [],
        isListed: true,
      };

      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(null, null, null, [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(0);
    });

    it("should match child competences with parent competence codes", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-85"],
        phases: [],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-851"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: createContextDto.description,
        sousTitre: service.sousTitre,
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: null,
        iframeUrl: null,
        isListed: true,
        extraFields: [],
      });
    });

    it("should match multiple child competences with parent competence code", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-85"],
        phases: [],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(
        ["90-851", "90-852"],
        null,
        "Idée",
        [ILE_DE_FRANCE_REGION_CODE],
      );

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0]).toEqual({
        id: service.id,
        createdAt: expect.any(Date),
        name: service.name,
        description: createContextDto.description,
        sousTitre: service.sousTitre,
        logoUrl: service.logoUrl,
        redirectionUrl: service.redirectionUrl,
        redirectionLabel: service.redirectionLabel,
        extendLabel: null,
        iframeUrl: null,
        isListed: true,
        extraFields: [],
      });
    });

    it("should not match children code on service with parent code on project", async () => {
      const service = await servicesService.create(servicePayload);

      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-851"],
        phases: [],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-85"], null, null, [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(0);
    });

    it("should match service regardless of phase when project has no phase", async () => {
      const service = await servicesService.create(servicePayload);
      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-411"],
        phases: ["Idée"],
        leviers: [],
        regions: [],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);
      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, null, [
        ILE_DE_FRANCE_REGION_CODE,
      ]);
      expect(serviceContexts).toHaveLength(1);
    });

    it("should match service when service context has empty regions array (matches all regions)", async () => {
      const service = await servicesService.create(servicePayload);
      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-411"],
        phases: [],
        leviers: [],
        regions: [], // Empty array means all regions
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0].name).toBe(service.name);
    });

    it("should match service when service context regions include project collectivite region", async () => {
      const service = await servicesService.create(servicePayload);
      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-411"],
        phases: [],
        leviers: [],
        regions: [ILE_DE_FRANCE_REGION_CODE], // Île-de-France (matches [ILE_DE_FRANCE_REGION_CODE])
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0].name).toBe(service.name);
    });

    it("should not match service when service context regions do not include project collectivite region", async () => {
      const service = await servicesService.create(servicePayload);
      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-411"],
        phases: [],
        leviers: [],
        regions: [VAL_DE_LOIRE_REGION_CODE], // Centre-Val de Loire (does not match [ILE_DE_FRANCE_REGION_CODE] which has "11")
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(0);
    });

    it("should match service when service context regions include multiple regions and one matches", async () => {
      const service = await servicesService.create(servicePayload);
      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-411"],
        isListed: true,
        phases: [],
        leviers: [],
        regions: [VAL_DE_LOIRE_REGION_CODE, ILE_DE_FRANCE_REGION_CODE], // Multiple regions including Île-de-France (11)
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0].name).toBe(service.name);
    });

    it("should match service when project has multiple collectivites and one matches service context regions", async () => {
      const service = await servicesService.create(servicePayload);
      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-411"],
        phases: [],
        leviers: [],
        regions: [VAL_DE_LOIRE_REGION_CODE], // Centre-Val de Loire
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, "Idée", [
        ILE_DE_FRANCE_REGION_CODE,
        VAL_DE_LOIRE_REGION_CODE,
      ]);

      expect(serviceContexts).toHaveLength(1);
      expect(serviceContexts[0].name).toBe(service.name);
    });

    it("should not match service when project collectivites have no region codes", async () => {
      const service = await servicesService.create(servicePayload);
      const createContextDto: CreateServiceContextRequest = {
        description: "Context Description",
        competences: ["90-411"],
        phases: [],
        leviers: [],
        regions: [ILE_DE_FRANCE_REGION_CODE],
        isListed: true,
      };
      await serviceContextService.create(service.id, createContextDto);

      const serviceContexts = await serviceContextService.findMatchingServicesContext(["90-411"], null, "Idée", []);

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
      competences: ["90-411", "90-311"],
      logoUrl: "https://test.com/context-logo.png",
      redirectionUrl: "https://test.com/context",
      leviers: ["Bio-carburants", "Covoiturage"],
      redirectionLabel: "Context Label",
      extendLabel: "Extend Label",
      phases: [],
      regions: [],
      isListed: true,
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
        regions: [],
        name: null,
      });
    });

    it("should throw ConflictException when creating a service context with duplicate description and sousTitre for the same service", async () => {
      const service = await servicesService.create(validService);
      await serviceContextService.create(service.id, validServiceContext);

      // Try to create second service context with same description and same sousTitre
      await expect(serviceContextService.create(service.id, validServiceContext)).rejects.toThrow(
        new ConflictException(
          `A service context with the description "${validServiceContext.description}" and sousTitre "${validServiceContext.sousTitre}" already exists for this service`,
        ),
      );
    });

    it("should not throw ConflictException when creating a service context with duplicate description but different sousTitre", async () => {
      const service = await servicesService.create(validService);
      await serviceContextService.create(service.id, validServiceContext);

      const context2 = await serviceContextService.create(service.id, {
        ...validServiceContext,
        sousTitre: "different sousTitre",
      });

      expect(context2).toBeDefined();
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
        competences: ["90-411", "90-311"],
        logoUrl: "https://test.com/context-logo.png",
        redirectionUrl: "https://test.com/context",
        leviers: ["Bio-carburants", "Covoiturage"],
        redirectionLabel: "Context Label",
        extendLabel: "Extend Label",
        phases: [],
        extraFields: [
          { name: "field1", label: "field1 label" },
          { name: "field2", label: "field2 label" },
        ],
        regions: [],
        isListed: true,
      };

      const result = await serviceContextService.create(service.id, createContextDto);

      expect(result).toEqual({
        id: expect.any(String),
        serviceId: service.id,
        ...createContextDto,
        iframeUrl: null,
        regions: [],
        name: null,
      });
    });
  });
});
