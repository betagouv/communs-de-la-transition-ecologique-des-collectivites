import { Module } from "@nestjs/common";
import { MecController } from "./mec.controller";
import { MecService } from "./mec.service";

// FIXME: Re-add BullModule.registerQueue({ name: PROJECT_QUALIFICATION_QUEUE_NAME })
// when the classification worker is adapted to support data_mec.
@Module({
  controllers: [MecController],
  providers: [MecService],
})
export class MecModule {}
