import { Module } from "@nestjs/common";
import { ProjectsService } from "./services/projects.service";
import { ProjectsController } from "./projects.controller";
import { CommunesService } from "./services/communes.service";
import { PorteurReferentsService } from "@projects/services/porteur-referents.service";

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, CommunesService, PorteurReferentsService],
})
export class ProjectsModule {}
