import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServicesContextService } from "./services-context.service";
import { CreateServiceContextRequest, CreateServiceContextResponse } from "./dto/create-service-context.dto";
import { Public } from "@/auth/public.decorator";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
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

  @Post("contexts")
  @ApiOperation({ summary: "Create a new service context" })
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateServiceContextResponse,
    description: "The service context has been successfully created.",
  })
  createServiceContext(@Body() createContextDto: CreateServiceContextRequest): Promise<CreateServiceContextResponse> {
    return this.serviceContextService.create(createContextDto);
  }
}
