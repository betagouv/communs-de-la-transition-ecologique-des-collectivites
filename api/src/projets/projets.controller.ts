import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CreateOrUpdateProjetResponse, CreateProjetRequest } from "./dto/create-projet.dto";
import { UpdateProjetRequest } from "./dto/update-projet.dto";
import { ProjetResponse } from "./dto/projet.dto";
import { ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { Request } from "express";
import { BulkCreateProjetsRequest, BulkCreateProjetsResponse } from "./dto/bulk-create-projets.dto";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { Public } from "@/auth/public.decorator";
import { UUIDDto } from "@/shared/dto/uuid";
import { ExtraFieldsService } from "@projets/services/extra-fields/extra-fields.service";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { CreateProjetsService } from "@projets/services/create-projets/create-projets.service";
import { CreateProjetExtraFieldRequest, ExtraField } from "@projets/dto/extra-fields.dto";
import { extractApiKey } from "@projets/extract-api-key";
import { UpdateProjetsService } from "@projets/services/update-projets/update-projets.service";
import { ProjectPublicInfoResponse } from "@projets/dto/project-public-info.dto";
import { IdType, idTypes } from "@/shared/types";
import { ProjectId, ProjectIdType } from "@/shared/decorator/projetId-decorator";

@ApiBearerAuth()
@Controller("projets")
@UseGuards(ApiKeyGuard)
export class ProjetsController {
  constructor(
    private readonly projetCreateService: CreateProjetsService,
    private readonly projetFindService: GetProjetsService,
    private readonly projetUpdateService: UpdateProjetsService,
    private readonly extraFieldsService: ExtraFieldsService,
  ) {}

  @ApiOperation({ summary: "Get all Projets" })
  @Get()
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjetResponse,
    isArray: true,
  })
  findAll(): Promise<ProjetResponse[]> {
    return this.projetFindService.findAll();
  }

  @ApiOperation({ summary: "Get specific Projet by id" })
  @ApiEndpointResponses({ successStatus: 200, response: ProjetResponse })
  @Get(":id")
  findOne(@Param() { id }: UUIDDto): Promise<ProjetResponse> {
    return this.projetFindService.findOne(id);
  }

  @Public()
  @ApiEndpointResponses({ successStatus: 200, response: ProjectPublicInfoResponse })
  @ApiQuery({ name: "idType", enum: idTypes, required: true, description: "Type of ID provided" })
  @Get(":id/public-info")
  getPublicInfo(
    @ProjectId() id: ProjectIdType[IdType],
    @Query("idType") idType: IdType,
  ): Promise<ProjectPublicInfoResponse> {
    return this.projetFindService.getPublicInfo(id, idType);
  }

  @Public()
  @ApiEndpointResponses({ successStatus: 200, response: ExtraField, isArray: true })
  @ApiQuery({ name: "idType", enum: idTypes, required: true, description: "Type of ID provided" })
  @Get(":id/extra-fields")
  getExtraFields(@ProjectId() id: ProjectIdType[IdType], @Query("idType") idType: IdType): Promise<ExtraField[]> {
    return this.extraFieldsService.getExtraFieldsByProjetId(id, idType);
  }

  @Public()
  @ApiEndpointResponses({ successStatus: 201, response: ExtraField, isArray: true })
  @ApiQuery({ name: "idType", enum: idTypes, required: true, description: "Type of ID provided" })
  @Post(":id/extra-fields")
  updateExtraFields(
    @ProjectId() id: ProjectIdType[IdType],
    @Query("idType") idType: IdType,
    @Body() extraFieldsDto: CreateProjetExtraFieldRequest,
  ): Promise<ExtraField[]> {
    return this.extraFieldsService.createExtraFields(id, extraFieldsDto, idType);
  }

  @Post()
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateOrUpdateProjetResponse,
    description: "Projet created successfully",
  })
  create(@Req() request: Request, @Body() createProjetDto: CreateProjetRequest): Promise<CreateOrUpdateProjetResponse> {
    return this.projetCreateService.create(createProjetDto, extractApiKey(request));
  }

  @ApiOperation({ summary: "Create new Projets in bulk" })
  @Post("bulk")
  @ApiEndpointResponses({
    successStatus: 201,
    response: BulkCreateProjetsResponse,
    description: "Bulk Projets created successfully",
  })
  createBulk(
    @Req() request: Request,
    @Body() createProjetsDto: BulkCreateProjetsRequest,
  ): Promise<BulkCreateProjetsResponse> {
    return this.projetCreateService.createBulk(createProjetsDto, extractApiKey(request));
  }

  @ApiOperation({ summary: "Update a specific Projet" })
  @Patch(":id")
  @ApiEndpointResponses({
    successStatus: 200,
    response: CreateOrUpdateProjetResponse,
    description: "Projet updated successfully",
  })
  update(
    @Req() request: Request,
    @Param() { id }: UUIDDto,
    @Body() updateProjetDto: UpdateProjetRequest,
  ): Promise<CreateOrUpdateProjetResponse> {
    return this.projetUpdateService.update(id, updateProjetDto, extractApiKey(request));
  }
}
