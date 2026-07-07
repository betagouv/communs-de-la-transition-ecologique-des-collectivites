import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { DecisionsController } from "./decisions.controller";
import { DecisionsService } from "./decisions.service";

@Module({
  imports: [DatabaseModule],
  controllers: [DecisionsController],
  providers: [DecisionsService],
})
export class DecisionsModule {}
