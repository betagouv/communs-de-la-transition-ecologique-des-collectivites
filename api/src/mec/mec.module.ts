import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { MecController } from "./mec.controller";
import { MecService } from "./mec.service";
import { PROJECT_QUALIFICATION_QUEUE_NAME } from "@/projet-qualification/const";

@Module({
  imports: [BullModule.registerQueue({ name: PROJECT_QUALIFICATION_QUEUE_NAME })],
  controllers: [MecController],
  providers: [MecService],
})
export class MecModule {}
