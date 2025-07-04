import { Body, Controller, Get, Param, Post, Query, UseGuards, ValidationPipe } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServicesContextService } from "./services-context.service";
import { CreateServiceContextRequest, CreateServiceContextResponse } from "./dto/create-service-context.dto";
import { Public } from "@/auth/public.decorator";
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { CreateServiceRequest, CreateServiceResponse } from "@/services/dto/create-service.dto";
import { ServiceApiKeyGuard } from "@/auth/service-api-key-guard";
import { GetServicesByContextQuery, ServicesByProjectIdResponse } from "@/services/dto/service.dto";
import { UUIDDto } from "@/shared/dto/uuid";
import { IdType, idTypes } from "@/shared/types";
import { ProjectId, ProjectIdType } from "@/shared/decorator/projetId-decorator";

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
  @ApiQuery({ name: "idType", enum: idTypes, required: true, description: "Type of ID provided" })
  @ApiParam({ name: "id", type: String, required: true })
  @Get("project/:id")
  getServicesByProjectId(
    @ProjectId() id: ProjectIdType[IdType],
    @Query("debug") debug: boolean,
    @Query("idType") idType: IdType,
  ): Promise<ServicesByProjectIdResponse[]> {
    if (debug) {
      return this.serviceContextService.getAllServicesContexts();
    }
    return this.servicesService.getServicesByProjectId(id, idType);
  }

  @Public()
  @ApiOperation({ summary: "Get all services corresponding to a context" })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ServicesByProjectIdResponse,
    isArray: true,
  })
  @Get("search/context")
  getServicesByContext(
    @Query(new ValidationPipe())
    query: GetServicesByContextQuery,
  ) {
    return this.serviceContextService.getServiceContextByContext(
      // if competences or leviers are omitted
      // that means we remove this criteria by passing null to the matching algorithm
      query.competences ?? null,
      query.leviers ?? null,
      query.phases,
    );
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
  @Post("contexts/:id")
  @ApiOperation({ summary: "Create a new service context for a specific service to match some projects " })
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateServiceContextResponse,
    description: "Service context created successfully",
  })
  createServiceContext(
    @Param() { id }: UUIDDto,
    @Body() createServiceContextDto: CreateServiceContextRequest,
  ): Promise<CreateServiceContextResponse> {
    return this.serviceContextService.create(id, createServiceContextDto);
  }
}
