import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { CollectivitesService } from "./services/collectivites/collectivites.service";
import { CreateProjectsService } from "@projects/services/create-projects/create-projects.service";
import { UpdateProjectsService } from "@projects/services/update-projects/update-projects.service";
import { GetProjectsService } from "@projects/services/get-projects/get-projects.service";
import { ServiceIdentifierService } from "@projects/services/service-identifier/service-identifier.service";
import { ExtraFieldsService } from "@projects/services/extra-fields/extra-fields.service";
import { GeoModule } from "@/geo/geo.module";

@Module({
  imports: [GeoModule],
  controllers: [ProjectsController],
  providers: [
    CollectivitesService,
    CreateProjectsService,
    GetProjectsService,
    UpdateProjectsService,
    ServiceIdentifierService,
    ExtraFieldsService,
  ],
})
export class ProjectsModule {}
