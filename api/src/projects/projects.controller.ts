import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { CreateOrUpdateProjectResponse, CreateProjectRequest } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectResponse } from "./dto/project.dto";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { Request } from "express";
import { CreateProjectsService } from "./services/create-projects/create-projects.service";
import { UpdateProjectsService } from "./services/update-projects/update-projects.service";
import { GetProjectsService } from "@projects/services/get-projects/get-projects.service";
import { BulkCreateProjectsRequest, BulkCreateProjectsResponse } from "./dto/bulk-create-projects.dto";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { extractApiKey } from "@projects/extract-api-key";

@ApiBearerAuth()
@Controller("projects")
@UseGuards(ApiKeyGuard)
export class ProjectsController {
  constructor(
    private readonly projectCreateService: CreateProjectsService,
    private readonly projectFindService: GetProjectsService,
    private readonly projectUpdateService: UpdateProjectsService,
  ) {}

  @ApiOperation({ summary: "Get all projects" })
  @Get()
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjectResponse,
    isArray: true,
  })
  findAll(): Promise<ProjectResponse[]> {
    return this.projectFindService.findAll();
  }

  @ApiOperation({ summary: "Get specific project by id" })
  @ApiEndpointResponses({ successStatus: 200, response: ProjectResponse })
  @Get(":id")
  findOne(@Param("id") id: string): Promise<ProjectResponse> {
    return this.projectFindService.findOne(id);
  }

  @ApiOperation({ summary: "Create a new project" })
  @Post()
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateOrUpdateProjectResponse,
    description: "Project created successfully",
  })
  create(
    @Req() request: Request,
    @Body() createProjectDto: CreateProjectRequest,
  ): Promise<CreateOrUpdateProjectResponse> {
    return this.projectCreateService.create(createProjectDto, extractApiKey(request));
  }

  @ApiOperation({ summary: "Create new projects in bulk" })
  @Post("bulk")
  @ApiEndpointResponses({
    successStatus: 201,
    response: BulkCreateProjectsResponse,
    description: "Bulk Projects created successfully",
  })
  createBulk(
    @Req() request: Request,
    @Body() createProjectsDto: BulkCreateProjectsRequest,
  ): Promise<BulkCreateProjectsResponse> {
    return this.projectCreateService.createBulk(createProjectsDto, extractApiKey(request));
  }

  @ApiOperation({ summary: "Update a specific project" })
  @Patch(":id")
  @ApiEndpointResponses({
    successStatus: 200,
    response: CreateOrUpdateProjectResponse,
    description: "Project updated successfully",
  })
  update(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): Promise<CreateOrUpdateProjectResponse> {
    return this.projectUpdateService.update(id, updateProjectDto, extractApiKey(request));
  }
}
