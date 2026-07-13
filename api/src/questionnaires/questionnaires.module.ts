import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { ProjetsModule } from "@projets/projets.module";
import { AidesMatchingService } from "@/aides/aides-matching.service";
import { QuestionnairesController } from "./questionnaires.controller";
import { QuestionnairesService } from "./questionnaires.service";

@Module({
  imports: [DatabaseModule, ProjetsModule],
  controllers: [QuestionnairesController],
  providers: [
    QuestionnairesService,
    // Le moteur de matching est fourni ici plutôt qu'importé depuis AidesModule : il est
    // sans état (seule dépendance : le logger), et importer AidesModule entraînerait ses
    // files BullMQ et son cron de synchronisation quotidienne, dont on n'a aucun besoin.
    AidesMatchingService,
  ],
  // Exporté : la source de recommandations « questionnaire » consomme le même état
  // (éligibilité + réponses réconciliées), pour éviter d'en avoir deux définitions.
  exports: [QuestionnairesService],
})
export class QuestionnairesModule {}
