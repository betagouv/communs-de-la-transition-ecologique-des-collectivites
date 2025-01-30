import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { CreateOrUpdateProjectResponse, CreateProjectRequest } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectResponse } from "./dto/project.dto";
import { ApiBearerAuth } from "@nestjs/swagger";
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

  @Get()
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjectResponse,
    isArray: true,
  })
  findAll(): Promise<ProjectResponse[]> {
    return this.projectFindService.findAll();
  }

  @ApiEndpointResponses({ successStatus: 200, response: ProjectResponse })
  @Get(":id")
  findOne(@Param("id") id: string): Promise<ProjectResponse> {
    return this.projectFindService.findOne(id);
  }

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

  @Post("bulk")
  @ApiEndpointResponses({
    successStatus: 201,
    response: BulkCreateProjectsResponse,
    description: "Bulk Projects created successfully",
  })
  async createBulk(
    @Req() request: Request,
    @Body() createProjectsDto: BulkCreateProjectsRequest,
  ): Promise<BulkCreateProjectsResponse> {
    return await this.projectCreateService.createBulk(createProjectsDto, extractApiKey(request));
  }

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
