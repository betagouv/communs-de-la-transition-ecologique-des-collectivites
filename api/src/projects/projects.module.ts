import { Module } from "@nestjs/common";
import { ProjectsService } from "./services/projects.service";
import { ProjectsController } from "./projects.controller";
import { CommunesService } from "./services/communes.service";
import { CollaboratorsService } from "@/collaborators/collaborators.service";

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, CommunesService, CollaboratorsService],
})
export class ProjectsModule {}
