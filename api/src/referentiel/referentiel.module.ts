import { Module } from "@nestjs/common";
import { CommunesController } from "./communes/communes.controller";
import { CommunesService } from "./communes/communes.service";
import { GroupementsController } from "./groupements/groupements.controller";
import { GroupementsService } from "./groupements/groupements.service";
import { CompetencesController } from "./competences/competences.controller";
import { CompetencesService } from "./competences/competences.service";
import { RechercheController } from "./recherche/recherche.controller";
import { RechercheService } from "./recherche/recherche.service";
import { DispositifsController } from "./dispositifs/dispositifs.controller";
import { DispositifsService } from "./dispositifs/dispositifs.service";

@Module({
  controllers: [
    CommunesController,
    GroupementsController,
    CompetencesController,
    RechercheController,
    DispositifsController,
  ],
  providers: [CommunesService, GroupementsService, CompetencesService, RechercheService, DispositifsService],
})
export class ReferentielModule {}
