import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { ProjetsModule } from "@projets/projets.module";
import { AidesMatchingService } from "@/aides/aides-matching.service";
import { QuestionnairesModule } from "@/questionnaires/questionnaires.module";
import { AidesModule } from "@/aides/aides.module";
import { AidesPerimetreModule } from "@/aides/aides-perimetre.module";
import { ServicesNumeriquesModule } from "@/services-numeriques/services-numeriques.module";
import { RecommandationsModule } from "@/recommandations/recommandations.module";
import { AdminController } from "./admin.controller";
import { AdminAjoutsController } from "./admin-ajouts.controller";
import { AjoutsManuelsModule } from "@/ajouts-manuels/ajouts-manuels.module";
import { AdminService } from "./admin.service";

/**
 * Module du back-office. ADDITIF : aucun autre module ne l'importe.
 *
 * Il ÉDITE désormais les questionnaires, mais il ne réimplémente rien : il passe par
 * `QuestionnairesRepository`, la même porte que la lecture — et donc par la même validation. Un
 * second chemin d'écriture aurait fini par diverger, et la validation aurait été contournable.
 *
 * Le supprimer : `rm -rf src/admin`, puis retirer son import dans app.module.ts. Les
 * questionnaires resteront lisibles et éditables par l'API, simplement plus par un écran.
 */
@Module({
  imports: [
    DatabaseModule,
    ProjetsModule,
    QuestionnairesModule,
    AidesModule,
    AidesPerimetreModule,
    ServicesNumeriquesModule,
    RecommandationsModule,
    AjoutsManuelsModule,
  ],
  controllers: [AdminController, AdminAjoutsController],
  // Même moteur de score que les aides, les questionnaires et les services : la simulation doit
  // dire la VÉRITÉ. Un portage du scoring dans le back-office afficherait des chiffres faux, et
  // les seuils seraient calibrés sur un mensonge.
  providers: [AdminService, AidesMatchingService],
})
export class AdminModule {}
