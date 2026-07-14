import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { ProjetsModule } from "@projets/projets.module";
import { AjoutsManuelsModule } from "@/ajouts-manuels/ajouts-manuels.module";
import { AidesMatchingService } from "@/aides/aides-matching.service";
import { ServicesNumeriquesController } from "./services-numeriques.controller";
import { ServicesNumeriquesService } from "./services-numeriques.service";

@Module({
  imports: [DatabaseModule, ProjetsModule, AjoutsManuelsModule],
  controllers: [ServicesNumeriquesController],
  providers: [
    ServicesNumeriquesService,
    // Même moteur de score que les aides et les questionnaires. Fourni ici plutôt qu'importé
    // depuis AidesModule : il est sans état, et AidesModule entraînerait ses files BullMQ et
    // son cron de synchronisation quotidienne.
    AidesMatchingService,
  ],
  // Exporté : l'aperçu du back-office doit montrer ce que l'API renvoie RÉELLEMENT. Il appelle donc
  // la MÊME fonction que GET /projets/:id/services — pas une reconstitution, qui divergerait.
  exports: [ServicesNumeriquesService],
})
export class ServicesNumeriquesModule {}
