import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServicesContextService } from "./services-context.service";
import { CreateServiceContextRequest, CreateServiceContextResponse } from "./dto/create-service-context.dto";
import { Public } from "@/auth/public.decorator";
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { CreateServiceRequest, CreateServiceResponse } from "@/services/dto/create-service.dto";
import { ServiceApiKeyGuard } from "@/auth/service-api-key-guard";
import { ServicesByProjectIdResponse } from "@/services/dto/service.dto";
import { fakeServiceData } from "@/services/fake-service-data";

@ApiBearerAuth()
@ApiTags("services")
@Controller("services")
@UseGuards(ServiceApiKeyGuard)
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly serviceContextService: ServicesContextService,
  ) {}

  @ApiExcludeEndpoint()
  @Public()
  @Get("debug-sentry")
  getError(): void {
    throw new Error("My first Sentry error!");
  }

  @Public()
  @ApiOperation({ summary: "Get all services corresponding to a project" })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ServicesByProjectIdResponse,
    isArray: true,
  })
  @Get("project/:projectId")
  getServicesByProjectId(
    @Param("projectId") projectId: string,
    @Query("debug") debug: boolean,
  ): Promise<ServicesByProjectIdResponse[]> {
    // todo this should be changed to send back all service context
    // when we'll have them properly defined
    if (debug) {
      return Promise.resolve(fakeServiceData);
    }
    return this.servicesService.getServicesByProjectId(projectId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new service" })
  @Post()
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateServiceResponse,
    description: "Service created successfully",
  })
  create(@Body() createServiceDto: CreateServiceRequest): Promise<CreateServiceResponse> {
    return this.servicesService.create(createServiceDto);
  }

  @ApiBearerAuth()
  @Post("contexts/:serviceId")
  @ApiOperation({ summary: "Create a new service context for a specific service to match some projects " })
  @ApiParam({ name: "serviceId", description: "ID of the service" })
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateServiceContextResponse,
    description: "Service context created successfully",
  })
  createServiceContext(
    @Param("serviceId") serviceId: string,
    @Body() createServiceContextDto: CreateServiceContextRequest,
  ): Promise<CreateServiceContextResponse> {
    return this.serviceContextService.create(serviceId, createServiceContextDto);
  }
}
