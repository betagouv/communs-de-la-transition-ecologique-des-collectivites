import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServiceContextService } from "./service-context.service";
import { CreateServiceContextDto } from "./dto/create-service-context.dto";
import { Public } from "@/auth/public.decorator";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { CreateServiceRequest, CreateServiceResponse } from "@/services/dto/create-service.dto";

@ApiBearerAuth()
@ApiTags("services")
@Controller("services")
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly serviceContextService: ServiceContextService,
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
  @ApiResponse({
    status: 201,
    description: "The service context has been successfully created.",
    // You might want to create a response DTO as well
  })
  @ApiResponse({ status: 400, description: "Invalid input" })
  createServiceContext(@Body() createContextDto: CreateServiceContextDto) {
    return this.serviceContextService.create(createContextDto);
  }
}
