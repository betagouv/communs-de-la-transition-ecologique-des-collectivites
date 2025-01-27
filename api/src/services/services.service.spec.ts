import { ServicesService } from "./services.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateServiceRequest } from "./dto/create-service.dto";
import { TestingModule } from "@nestjs/testing";

describe("ServicesService", () => {
  let service: ServicesService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<ServicesService>(ServicesService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
  });

  describe("create", () => {
    it("should create a new service", async () => {
      const createDto: CreateServiceRequest = {
        name: "Test Service",
        description: "Test Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Go on test service",
        extendLabel: "Extend label",
        iframeUrl: "https://test.com/iframe",
      };

      const result = await service.create(createDto);

      expect(result).toEqual({
        id: expect.any(String),
        createdAt: expect.any(Date),
        ...createDto,
      });
    });
  });

  describe("getServicesByProjectId", () => {
    it("should return mock services for now", () => {
      const result = service.getServicesByProjectId("any-id");
      expect(result).toHaveLength(5);
      expect(result[0]).toHaveProperty("name", "Facili-Tacct");
      expect(result[1]).toHaveProperty("name", "La boussole de la transition écologique");
    });
  });
});
