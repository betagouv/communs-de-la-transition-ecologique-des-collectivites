import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { CommunesService } from "./services/communes/communes.service";
import { CreateProjectsService } from "@projects/services/create-projects/create-projects.service";
import { UpdateProjectsService } from "@projects/services/update-projects/update-projects.service";
import { CompetencesService } from "@projects/services/competences/competences.service";
import { GetProjectsService } from "@projects/services/get-projects/get-projects.service";

@Module({
  controllers: [ProjectsController],
  providers: [CommunesService, CompetencesService, CreateProjectsService, GetProjectsService, UpdateProjectsService],
})
export class ProjectsModule {}
