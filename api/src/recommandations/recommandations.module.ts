import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { ProjetsModule } from "@projets/projets.module";
import { DecisionsModule } from "@/decisions/decisions.module";
import { QuestionnairesModule } from "@/questionnaires/questionnaires.module";
import { RecommandationsController } from "./recommandations.controller";
import { RecommandationsService } from "./recommandations.service";
import { RECOMMANDATION_SOURCES } from "./recommandation-source";
import { QuestionnaireRecommandationSource } from "./sources/questionnaire.source";

@Module({
  imports: [DatabaseModule, ProjetsModule, DecisionsModule, QuestionnairesModule],
  controllers: [RecommandationsController],
  providers: [
    RecommandationsService,
    // Registre des sources. Ajouter une source (diagnostic, aide détectée, règle métier…)
    // se fait ICI et nulle part ailleurs : ni le contrôleur, ni le contrat public ne bougent.
    QuestionnaireRecommandationSource,
    {
      provide: RECOMMANDATION_SOURCES,
      useFactory: (questionnaire: QuestionnaireRecommandationSource) => [questionnaire],
      inject: [QuestionnaireRecommandationSource],
    },
  ],
})
export class RecommandationsModule {}
