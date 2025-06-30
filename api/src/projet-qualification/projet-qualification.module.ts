import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ProjetQualificationService } from "./projet-qualification.service";
import { ProjetsModule } from "@projets/projets.module";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { BullBoardModule } from "@bull-board/nestjs";
import { PROJECT_QUALIFICATION_QUEUE_NAME } from "@/projet-qualification/const";
import { ProjetQualificationController } from "@/projet-qualification/projet-qualification.controller";

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
  ],
  controllers: [ProjetQualificationController],
  providers: [ProjetQualificationService],
})
export class ProjetQualificationModule {}
