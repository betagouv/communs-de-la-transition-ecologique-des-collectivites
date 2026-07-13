import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { ProjetQuestionnairesResponse, PutReponsesRequest } from "./dto/questionnaire.dto";
import { QuestionnairesService } from "./questionnaires.service";

@ApiBearerAuth()
@ApiTags("Questionnaires")
@Controller("projets/:projetId/questionnaires")
@UseGuards(ApiKeyGuard)
export class QuestionnairesController {
  constructor(private readonly questionnairesService: QuestionnairesService) {}

  @TrackApiUsage()
  @Get()
  @ApiOperation({
    summary: "Questionnaires éligibles d'un projet",
    description:
      "Renvoie les questionnaires proposés au projet, avec les réponses déjà enregistrées et le statut " +
      "calculé. L'éligibilité est décidée par l'API : un projet sans questionnaire proposé reçoit une " +
      "liste vide (200, pas 404). Ne renvoie AUCUNE recommandation — ressource distincte (GET " +
      "/projets/{projetId}/recommandations).",
  })
  @ApiParam({ name: "projetId", description: "Identifiant Communs du projet (UUID)." })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjetQuestionnairesResponse,
    description: "Questionnaires éligibles, éventuellement vide",
  })
  findForProjet(@Param("projetId", ParseUUIDPipe) projetId: string): Promise<ProjetQuestionnairesResponse> {
    return this.questionnairesService.findForProjet(projetId);
  }

  @TrackApiUsage()
  @Put(":slug/reponses")
  @ApiOperation({
    summary: "Enregistre l'intégralité des réponses d'un questionnaire (idempotent)",
    description:
      "Le corps porte le jeu COMPLET des réponses connues, jamais un delta : une question absente est " +
      "considérée comme non répondue, ce qui permet la désélection. Le statut est recalculé par l'API. " +
      "Enregistrer des réponses fait évoluer les recommandations que la source « questionnaire » " +
      "contribue : recharger GET /projets/{projetId}/recommandations séparément.",
  })
  @ApiParam({ name: "projetId", description: "Identifiant Communs du projet (UUID)." })
  @ApiParam({ name: "slug", description: "Identifiant stable du questionnaire.", example: "atoutbiodiv-salle" })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjetQuestionnairesResponse,
    description: "Questionnaires à jour",
  })
  remplacerReponses(
    @Param("projetId", ParseUUIDPipe) projetId: string,
    @Param("slug") slug: string,
    @Body() dto: PutReponsesRequest,
  ): Promise<ProjetQuestionnairesResponse> {
    return this.questionnairesService.remplacerReponses(projetId, slug, dto.reponses);
  }
}
