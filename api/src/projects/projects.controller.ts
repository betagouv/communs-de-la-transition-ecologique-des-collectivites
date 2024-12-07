import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ProjectsService } from "./services/projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectDto } from "./dto/project.dto";
import { ApiBearerAuth } from "@nestjs/swagger";
import { RequiresCollaboratorsPermission } from "@/collaborators/collaborators.permissions.decorator";

@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@Body() createProjectDto: CreateProjectDto): Promise<{ id: string }> {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  findAll(): Promise<ProjectDto[]> {
    return this.projectsService.findAll();
  }

  @RequiresCollaboratorsPermission()
  @Get(":id")
  findOne(@Param("id") id: string): Promise<ProjectDto> {
    return this.projectsService.findOne(id);
  }

  //todo to implement
  @RequiresCollaboratorsPermission()
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): string {
    return this.projectsService.update(id, updateProjectDto);
  }

  //todo to implement
  @RequiresCollaboratorsPermission()
  @Delete(":id")
  remove(@Param("id") id: string): string {
    return this.projectsService.remove(id);
  }
}
