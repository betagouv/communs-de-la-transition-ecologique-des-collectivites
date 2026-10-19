import { Module } from "@nestjs/common";
import { CommunesController } from "./communes/communes.controller";
import { CommunesService } from "./communes/communes.service";
import { GroupementsController } from "./groupements/groupements.controller";
import { GroupementsService } from "./groupements/groupements.service";
import { CompetencesController } from "./competences/competences.controller";
import { CompetencesService } from "./competences/competences.service";
import { RechercheController } from "./recherche/recherche.controller";
import { RechercheService } from "./recherche/recherche.service";
import { TaxonomiesController } from "./taxonomies/taxonomies.controller";
import { DepartementsController, RegionsController } from "./departements-regions/departements-regions.controller";
import { DepartementsRegionsService } from "./departements-regions/departements-regions.service";

@Module({
  controllers: [
    CommunesController,
    GroupementsController,
    CompetencesController,
    RechercheController,
    TaxonomiesController,
    DepartementsController,
    RegionsController,
  ],
  providers: [CommunesService, GroupementsService, CompetencesService, RechercheService, DepartementsRegionsService],
})
export class ReferentielModule {}
