import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServicesContextService } from "./services-context.service";
import { CreateServiceContextRequest, CreateServiceContextResponse } from "./dto/create-service-context.dto";
import { Public } from "@/auth/public.decorator";
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { CreateServiceRequest, CreateServiceResponse } from "@/services/dto/create-service.dto";
import { ServiceApiKeyGuard } from "@/auth/service-api-key-guard";

@ApiBearerAuth()
@ApiTags("services")
@Controller("services")
@UseGuards(ServiceApiKeyGuard)
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly serviceContextService: ServicesContextService,
  ) {}

  @Public()
  @Get("debug-sentry")
  getError(): void {
    throw new Error("My first Sentry error!");
  }

  @Public()
  @ApiOperation({ summary: "Get all services corresponding to a project" })
  @Get("project/:projectId")
  getServicesByProjectId(@Param("projectId") projectId: string) {
    return this.servicesService.getServicesByProjectId(projectId);
  }

  @Post()
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateServiceResponse,
    description: "Service created successfully",
  })
  create(@Body() createServiceDto: CreateServiceRequest): Promise<CreateServiceResponse> {
    return this.servicesService.create(createServiceDto);
  }

  @Post(":serviceId/contexts")
  @ApiOperation({ summary: "Create a new service context" })
  @ApiParam({ name: "serviceId", description: "ID of the service" })
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateServiceContextResponse,
    description: "Service context created successfully",
  })
  async createServiceContext(
    @Param("serviceId") serviceId: string,
    @Body() createServiceContextDto: CreateServiceContextRequest,
  ): Promise<CreateServiceContextResponse> {
    return this.serviceContextService.create(serviceId, createServiceContextDto);
  }
}
