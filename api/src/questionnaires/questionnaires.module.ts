import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { ProjetsModule } from "@projets/projets.module";
import { QuestionnairesController } from "./questionnaires.controller";
import { QuestionnairesAdminController } from "./questionnaires-admin.controller";
import { QuestionnairesService } from "./questionnaires.service";
import { QuestionnairesRepository } from "./questionnaires.repository";

@Module({
  imports: [DatabaseModule, ProjetsModule],
  // Deux contrôleurs, deux publics : la LECTURE pour les plateformes partenaires (ApiKeyGuard),
  // l'ÉCRITURE pour l'administration (ServiceApiKeyGuard). L'écriture reste dans le domaine, et non
  // dans le module du back-office — qui doit rester jetable.
  controllers: [QuestionnairesController, QuestionnairesAdminController],
  providers: [QuestionnairesService, QuestionnairesRepository],
  // `QuestionnairesService` est exporté parce que la source de recommandations « questionnaire »
  // consomme le même état (éligibilité + réponses réconciliées) : une seule définition.
  //
  // `QuestionnairesRepository` l'est pour que le back-office puisse LIRE le contenu (simulation).
  // L'écriture, elle, ne sort pas de ce module : elle passe par QuestionnairesAdminController.
  exports: [QuestionnairesService, QuestionnairesRepository],
})
export class QuestionnairesModule {}
