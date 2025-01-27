import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "@/app.module";
import { ServicesController } from "@/services/services.controller";
import { ServicesService } from "@/services/services.service";
import { ServicesContextService } from "@/services/services-context.service";
import { CreateServiceRequest } from "@/services/dto/create-service.dto";
import { CreateServiceContextRequest } from "@/services/dto/create-service-context.dto";

describe("ServiceController", () => {
  let controller: ServicesController;
  let serviceServices: ServicesService;
  let serviceContextServices: ServicesContextService;
  let app: TestingModule;

  beforeEach(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    controller = app.get<ServicesController>(ServicesController);
    serviceServices = app.get<ServicesService>(ServicesService);
    serviceContextServices = app.get<ServicesContextService>(ServicesContextService);
  });

  afterEach(async () => {
    await app.close();
  });

  const validService: CreateServiceRequest = {
    name: "Test Service",
    description: "Test Description",
    logoUrl: "https://test.com/logo.png",
    redirectionUrl: "https://test.com",
    redirectionLabel: "Go to test service",
  };

  describe("service", () => {
    it("should create a new service", async () => {
      const expectedResponse = { ...validService, id: "test-id", extendLabel: null, iframeUrl: null };
      jest.spyOn(serviceServices, "create").mockResolvedValue(expectedResponse);

      const result = await controller.create(validService);

      expect(result).toEqual(expectedResponse);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(serviceServices.create).toHaveBeenCalledWith(validService);
    });
  });

  describe("service context", () => {
    it("should create a new service context", async () => {
      const serviceId = "service-id";
      const validServiceContext: Omit<CreateServiceContextRequest, "serviceId"> = {
        competencesAndSousCompetences: ["Santé"],
        description: "Context Description",
        logoUrl: "https://test.com/logo.png",
        redirectionUrl: "https://test.com",
        redirectionLabel: "Go to test service",
        extendLabel: "Extend Label",
      };
      const expectedResponse = { ...validService, id: "service-context-id" };
      jest.spyOn(serviceContextServices, "create").mockResolvedValue(expectedResponse);

      const result = await controller.createServiceContext(serviceId, validServiceContext);

      expect(result).toEqual(expectedResponse);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(serviceContextServices.create).toHaveBeenCalledWith(serviceId, validServiceContext);
    });
  });
});
