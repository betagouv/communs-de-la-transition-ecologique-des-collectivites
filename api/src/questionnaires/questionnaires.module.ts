import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { ProjetsModule } from "@projets/projets.module";
import { QuestionnairesController } from "./questionnaires.controller";
import { QuestionnairesService } from "./questionnaires.service";
import { QuestionnairesRepository } from "./questionnaires.repository";

@Module({
  imports: [DatabaseModule, ProjetsModule],
  controllers: [QuestionnairesController],
  providers: [QuestionnairesService, QuestionnairesRepository],
  // `QuestionnairesService` est exporté parce que la source de recommandations « questionnaire »
  // consomme le même état (éligibilité + réponses réconciliées) : une seule définition.
  //
  // `QuestionnairesRepository` l'est parce que le back-office ÉDITE les questionnaires, et doit
  // passer par la MÊME porte que la lecture. Un second chemin d'écriture contournerait la
  // validation — or c'est elle qui remplace le refus de démarrage qu'on avait quand les
  // questionnaires vivaient dans le dépôt.
  exports: [QuestionnairesService, QuestionnairesRepository],
})
export class QuestionnairesModule {}
