import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ClassificationController } from "./classification.controller";
import { ClassificationService } from "./classification.service";
import { ClassificationAnthropicService } from "./llm/classification-anthropic.service";
import { ClassificationValidationService } from "./validation/classification-validation.service";
import { EnrichmentService } from "./post-processing/enrichment.service";
import { TEProbabilityService } from "./post-processing/te-probability.service";

@Module({
  imports: [ConfigModule],
  controllers: [ClassificationController],
  providers: [
    ClassificationService,
    ClassificationAnthropicService,
    ClassificationValidationService,
    EnrichmentService,
    TEProbabilityService,
  ],
  exports: [ClassificationService],
})
export class ClassificationModule {}
