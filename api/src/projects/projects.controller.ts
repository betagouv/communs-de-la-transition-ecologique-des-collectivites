import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ProjectsService } from "./services/projects.service";
import { CreateOrUpdateProjectResponse, CreateProjectRequest } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectResponse } from "./dto/project.dto";
import { ApiBearerAuth } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { Request } from "express";

@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

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
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjectResponse,
    isArray: true,
  })
  findAll(): Promise<ProjectResponse[]> {
    return this.projectsService.findAll();
  }

  @ApiEndpointResponses({ successStatus: 200, response: ProjectResponse })
  @Get(":id")
  findOne(@Param("id") id: string): Promise<ProjectResponse> {
    return this.projectsService.findOne(id);
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
    return this.projectsService.update(id, updateProjectDto);
  }

  //todo to implement
  @Delete(":id")
  remove(@Param("id") id: string): string {
    return this.projectsService.remove(id);
  }
}
