import { Module } from "@nestjs/common";
import { ProjectsService } from "./services/projects.service";
import { ProjectsController } from "./projects.controller";
import { CommunesService } from "./services/communes.service";
import { CollaboratorsModule } from "@/collaborators/collaborators.module";

@Module({
  imports: [CollaboratorsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, CommunesService],
})
export class ProjectsModule {}
