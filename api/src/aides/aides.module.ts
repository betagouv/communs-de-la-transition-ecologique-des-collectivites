import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ProjetsModule } from "@projets/projets.module";
import { ClassificationModule } from "@/projet-qualification/classification/classification.module";
import { AidesController } from "./aides.controller";
import { AidesTerritoiresService } from "./aides-territoires.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesMatchingService } from "./aides-matching.service";

@Module({
  imports: [ConfigModule, ProjetsModule, ClassificationModule],
  controllers: [AidesController],
  providers: [AidesTerritoiresService, AideClassificationService, AidesMatchingService],
  exports: [AideClassificationService],
})
export class AidesModule {}
