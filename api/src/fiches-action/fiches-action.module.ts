import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PROJECT_QUALIFICATION_QUEUE_NAME } from "@/projet-qualification/const";
import { FichesActionController } from "./fiches-action.controller";
import { FichesActionService } from "./fiches-action.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: PROJECT_QUALIFICATION_QUEUE_NAME,
    }),
  ],
  controllers: [FichesActionController],
  providers: [FichesActionService],
})
export class FichesActionModule {}
