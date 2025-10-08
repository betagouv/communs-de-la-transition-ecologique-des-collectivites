import { ServicesService } from "./services.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateServiceRequest } from "./dto/create-service.dto";
import { TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { collectivites } from "@database/schema";
import { mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";
import { CreateProjetsService } from "@projets/services/create-projets/create-projets.service";
import { ServicesContextService } from "@/services/services-context.service";
import { CreateServiceContextRequest } from "@/services/dto/create-service-context.dto";

describe("ServicesService", () => {
  let service: ServicesService;
  let serviceContext: ServicesContextService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let createProjectService: CreateProjetsService;
  const mockedCollectivites: CollectiviteReference = { type: "Commune", code: "01001" };

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<ServicesService>(ServicesService);
    serviceContext = module.get<ServicesContextService>(ServicesContextService);
    createProjectService = module.get<CreateProjetsService>(CreateProjetsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
    await testDbService.database
      .insert(collectivites)
      .values({ type: mockedCollectivites.type, codeInsee: mockedCollectivites.code, nom: "Commune 1" });
  });

  const serviceDTO: CreateServiceRequest = {
    name: "Test Service",
    description: "Test Description",
    sousTitre: "Test Sous Titre",
    logoUrl: "https://test.com/logo.png",
    redirectionUrl: "https://test.com",
    redirectionLabel: "Go on test service",
    extendLabel: "Extend label",
    iframeUrl: "https://test.com/iframe",
    isListed: true,
  };

  describe("create", () => {
    it("should create a new service", async () => {
      const result = await service.create(serviceDTO);

      expect(result).toEqual({
        id: expect.any(String),
        createdAt: expect.any(Date),
        ...serviceDTO,
      });
    });

    it("should throw ConflictException when creating a service with duplicate name", async () => {
      // Create first service
      await service.create(serviceDTO);

      // Try to create second service with same name
      await expect(service.create(serviceDTO)).rejects.toThrow(
        new ConflictException(`A service with the name "${serviceDTO.name}" already exists`),
      );
    });
  });

  describe("getServicesByProjectId", () => {
    it("should return no service for project without services", async () => {
      const createDto = mockProjetPayload();

      const project = await createProjectService.create(createDto, process.env.MEC_API_KEY!);

      const result = await service.getServicesByProjectId(project.id, "communId");
      expect(result).toStrictEqual([]);
    });

    it("should return 404 response when project does not exist services for now", async () => {
      await expect(service.getServicesByProjectId(crypto.randomUUID(), "communId")).rejects.toThrow(NotFoundException);
    });

    it("should return a specific service associated to a tet project through tet id", async () => {
      const createDto = mockProjetPayload({ externalId: "test-external-id", competences: ["90-851"] });
      await createProjectService.create(createDto, process.env.TET_API_KEY!);
      const createdService = await service.create(serviceDTO);

      const createServiceContextDto: CreateServiceContextRequest = {
        description: "Tet specific projet Context Description",
        competences: ["90-851"],
        phases: [],
        leviers: ["Bio-carburants"],
        regions: [],
        isListed: true,
      };

      await serviceContext.create(createdService.id, createServiceContextDto);

      const result = await service.getServicesByProjectId(createDto.externalId, "tetId");

      expect(result[0].description).toEqual(createServiceContextDto.description);
    });
  });
});
