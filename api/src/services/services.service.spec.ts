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

describe("ServicesService", () => {
  let service: ServicesService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let createProjectService: CreateProjetsService;
  const mockedCollectivites: CollectiviteReference = { type: "Commune", code: "01001" };

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<ServicesService>(ServicesService);
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

  describe("create", () => {
    const createDto: CreateServiceRequest = {
      name: "Test Service",
      description: "Test Description",
      sousTitre: "Test Sous Titre",
      logoUrl: "https://test.com/logo.png",
      redirectionUrl: "https://test.com",
      redirectionLabel: "Go on test service",
      extendLabel: "Extend label",
      iframeUrl: "https://test.com/iframe",
    };

    it("should create a new service", async () => {
      const result = await service.create(createDto);

      expect(result).toEqual({
        id: expect.any(String),
        createdAt: expect.any(Date),
        ...createDto,
        isListed: false,
      });
    });

    it("should throw ConflictException when creating a service with duplicate name", async () => {
      // Create first service
      await service.create(createDto);

      // Try to create second service with same name
      await expect(service.create(createDto)).rejects.toThrow(
        new ConflictException(`A service with the name "${createDto.name}" already exists`),
      );
    });
  });

  describe("getServicesByProjectId", () => {
    it("should return no service for project without services", async () => {
      const createDto = mockProjetPayload();

      const project = await createProjectService.create(createDto, "MEC_test_api_key");

      const result = await service.getServicesByProjectId(project.id);
      expect(result).toStrictEqual([]);
    });

    it("should return 404 response when project does not exist services for now", async () => {
      await expect(service.getServicesByProjectId(crypto.randomUUID())).rejects.toThrow(NotFoundException);
    });
  });
});
