import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { QualificationRateLimitGuard } from "@/projet-qualification/projet-qualification-rate-limit-guard";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { ClassificationRequest, ClassificationResponse } from "./dto/classification.dto";
import { ClassificationService } from "./classification.service";

@ApiBearerAuth()
@ApiTags("Qualification")
@Controller("qualification")
@UseGuards(ApiKeyGuard, QualificationRateLimitGuard)
export class ClassificationController {
  constructor(private readonly classificationService: ClassificationService) {}

  // this is a post because we do not want to be limited by the query params length to pass the description
  @TrackApiUsage()
  @Post("classification")
  @ApiOperation({
    summary: "Classifier un projet ou une aide",
    description:
      "Classifie un projet ou une aide selon 3 axes : thématiques, sites et interventions. Calcule également la probabilité de lien avec la transition écologique.",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ClassificationResponse,
    description: "Classification réussie",
  })
  async classify(@Body() request: ClassificationRequest): Promise<ClassificationResponse> {
    const context = `${request.nom} - ${request.description}`;
    return await this.classificationService.classify(context, request.type ?? "projet", request.scoreThreshold);
  }
}
