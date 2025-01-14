import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { CreateOrUpdateProjectResponse, CreateProjectRequest } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectResponse } from "./dto/project.dto";
import { ApiBearerAuth } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { Request } from "express";
import { CreateProjectsService } from "./services/create-projects/create-projects.service";
import { UpdateProjectsService } from "./services/update-projects/update-projects.service";
import { GetProjectsService } from "@projects/services/get-projects/get-projects.service";

@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projectCreateService: CreateProjectsService,
    private readonly projectFindService: GetProjectsService,
    private readonly projectUpdateService: UpdateProjectsService,
  ) {}

  @Post()
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateOrUpdateProjectResponse,
    description: "Project created successfully",
  })
  create(
    @Req() _request: Request,
    @Body() createProjectDto: CreateProjectRequest,
  ): Promise<CreateOrUpdateProjectResponse> {
    return this.projectCreateService.create(createProjectDto);
  }

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

  @Patch(":id")
  @ApiEndpointResponses({
    successStatus: 200,
    response: CreateOrUpdateProjectResponse,
    description: "Project updated successfully",
  })
  update(
    @Req() _request: Request,
    @Param("id") id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): Promise<CreateOrUpdateProjectResponse> {
    return this.projectUpdateService.update(id, updateProjectDto);
  }
}
