import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule } from "@nestjs/config";
import { ProjetQualificationService } from "./projet-qualification.service";
import { ProjetsModule } from "@projets/projets.module";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { BullBoardModule } from "@bull-board/nestjs";
import { PROJECT_QUALIFICATION_QUEUE_NAME } from "@/projet-qualification/const";
import { ProjetQualificationController } from "@/projet-qualification/projet-qualification.controller";
import { AnthropicService } from "@/projet-qualification/llm/anthropic.service";
import { LeviersValidationService } from "@/projet-qualification/llm/validation/leviers-validation.service";
import { CompetencesValidationService } from "@/projet-qualification/llm/validation/competences-validation.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: PROJECT_QUALIFICATION_QUEUE_NAME,
    }),
    BullBoardModule.forFeature({
      name: PROJECT_QUALIFICATION_QUEUE_NAME,
      adapter: BullMQAdapter,
    }),
    ProjetsModule,
    ConfigModule,
  ],
  controllers: [ProjetQualificationController],
  providers: [ProjetQualificationService, AnthropicService, LeviersValidationService, CompetencesValidationService],
})
export class ProjetQualificationModule {}
