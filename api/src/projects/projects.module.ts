import { Module } from "@nestjs/common";
import { ProjectsService } from "./services/projects.service";
import { ProjectsController } from "./projects.controller";
import { CommunesService } from "./services/communes.service";

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, CommunesService],
})
export class ProjectsModule {}
