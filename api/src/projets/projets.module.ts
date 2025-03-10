import { Module } from "@nestjs/common";
import { ProjetsController } from "./projets.controller";
import { CollectivitesService } from "./services/collectivites/collectivites.service";
import { GeoModule } from "@/geo/geo.module";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { CreateProjetsService } from "@projets/services/create-projets/create-projets.service";
import { ServiceIdentifierService } from "@projets/services/service-identifier/service-identifier.service";
import { ExtraFieldsService } from "@projets/services/extra-fields/extra-fields.service";
import { UpdateProjetsService } from "@projets/services/update-projets/update-projets.service";

@Module({
  imports: [GeoModule],
  controllers: [ProjetsController],
  providers: [
    CollectivitesService,
    CreateProjetsService,
    GetProjetsService,
    UpdateProjetsService,
    ServiceIdentifierService,
    ExtraFieldsService,
  ],
})
export class ProjetsModule {}
