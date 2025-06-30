import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { ProjetQualificationRequest, ProjetQualificationResponse } from "./dto/projet-qualification.dto";
import { ProjetQualificationService } from "@/projet-qualification/projet-qualification.service";
import { QualificationRateLimitGuard } from "@/projet-qualification/projet-qualification-rate-limit-guard";

@ApiBearerAuth()
@ApiTags("Qualification")
@Controller("qualification")
@UseGuards(ApiKeyGuard, QualificationRateLimitGuard)
export class ProjetQualificationController {
  constructor(private readonly qualificationApiService: ProjetQualificationService) {}

  @Post("competences")
  @ApiOperation({
    summary: "Qualifier les compétences d'un projet",
    description: "Qualifie la description d'un projet pour identifier les compétences pertinentes des collectivités",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjetQualificationResponse,
    description: "Qualification des compétences réussie",
  })
  async analyzeCompetences(
    @Req() request: Request,
    @Body() qualificationRequest: ProjetQualificationRequest,
  ): Promise<ProjetQualificationResponse> {
    const nameAndDescription = `${qualificationRequest.nom} - ${qualificationRequest.description}`;
    return await this.qualificationApiService.analyzeCompetences(nameAndDescription, request.serviceType!);
  }
}
