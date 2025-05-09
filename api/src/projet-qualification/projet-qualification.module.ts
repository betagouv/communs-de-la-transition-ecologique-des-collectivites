import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ProjetQualificationService } from "./projet-qualification.service";
import { ProjetsModule } from "@projets/projets.module";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "projet-qualification",
    }),
    ProjetsModule,
  ],
  providers: [ProjetQualificationService],
})
export class ProjetQualificationModule {}
