import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { TerritoiresController } from "./territoires.controller";
import { TerritoiresService } from "./territoires.service";

@Module({
  imports: [DatabaseModule],
  controllers: [TerritoiresController],
  providers: [TerritoiresService],
})
export class TerritoiresModule {}
