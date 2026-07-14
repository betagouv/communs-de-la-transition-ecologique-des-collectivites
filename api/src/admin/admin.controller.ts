import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ServiceApiKeyGuard } from "@/auth/service-api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { AdminService } from "./admin.service";
import {
  ContenuResponse,
  QuestionnaireEditionRequest,
  SimulationRequest,
  SimulationResponse,
  TaxonomiesResponse,
} from "./dto/admin.dto";

/**
 * Back-office : voir le contenu, et simuler ce que l'API renverrait pour un projet RÉEL.
 *
 * Derrière `ServiceApiKeyGuard` (SERVICE_MANAGEMENT_API_KEY) — le garde d'administration
 * existant, celui de /services et de la classification par lots. PAS une clé de plateforme
 * partenaire : ces endpoints exposent délibérément ce que le contrat public cache (conditions,
 * classifications, curation, scores).
 *
 * DÉLIBÉRÉMENT ABSENT du document OpenAPI. `setupProjetsDoc` produit le contrat servi aux
 * PLATEFORMES PARTENAIRES ; y publier ces endpoints ferait traverser la frontière à ce qu'on
 * prend soin de garder de notre côté (conditions, classifications d'éligibilité, curation). Le
 * back-office recopie ses types plutôt que de les importer — il n'a donc besoin d'aucun schéma
 * publié. Les décorateurs Swagger ci-dessous ne servent que si on décide un jour d'exposer un
 * second document, réservé à l'administration.
 *
 * Module ADDITIF et ISOLÉ : rien ne l'importe, il ne modifie rien. `rm -rf src/admin` plus UNE
 * ligne dans app.module.ts, et l'API repart exactement comme avant.
 */
@ApiBearerAuth()
@ApiTags("Administration")
@Controller("admin")
@UseGuards(ServiceApiKeyGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("contenu")
  @ApiOperation({
    summary: "Le contenu tel qu'il est réellement chargé",
    description:
      "Questionnaires (avec leurs conditions et leur classification d'éligibilité), catalogue de " +
      "services (avec curation, phases et classification), et les seuils en vigueur. C'est l'état " +
      "réel du moteur, pas une reconstruction.",
  })
  @ApiEndpointResponses({ successStatus: 200, response: ContenuResponse, description: "Contenu courant" })
  contenu(): Promise<ContenuResponse> {
    return this.adminService.contenu();
  }

  @Get("taxonomies")
  @ApiOperation({
    summary: "Les taxonomies fermées du schéma commun",
    description:
      "137 thématiques, 58 lieux, 15 modalités. Servies à l'éditeur pour qu'il ne propose QUE des " +
      "étiquettes valides : le sélecteur rend la coquille impossible, là où la validation ne fait " +
      "que la rattraper. Sans cet endpoint, le back-office devrait recopier les listes — et une " +
      "copie dérive.",
  })
  @ApiEndpointResponses({ successStatus: 200, response: TaxonomiesResponse, description: "Taxonomies" })
  taxonomies(): TaxonomiesResponse {
    return this.adminService.taxonomies();
  }

  @Put("questionnaires/:slug")
  @ApiOperation({
    summary: "Créer ou remplacer un questionnaire",
    description:
      "PUT, pas PATCH : un éditeur envoie le document qu'il a sous les yeux. Un PATCH champ par " +
      "champ autoriserait des états incohérents entre deux appels — une condition enregistrée avant " +
      "la question qu'elle vise.\n\n" +
      "TOUT est revalidé avant écriture, et un écart est un 400 explicite : étiquettes dans la " +
      "taxonomie fermée, AU MOINS une étiquette (une conjonction vide est vraie — le questionnaire " +
      "serait proposé à TOUS les projets), conditions pointant des questions et des options qui " +
      "existent. Ce sont exactement les vérifications que le chargeur faisait au démarrage quand les " +
      "questionnaires vivaient dans le dépôt. Aucune n'a été assouplie.\n\n" +
      "La `version` s'incrémente automatiquement. Elle n'invalide rien : les réponses des " +
      "collectivités devenues sans objet sont ignorées à la lecture, jamais effacées.",
  })
  @ApiEndpointResponses({ successStatus: 200, response: Object, description: "Questionnaire enregistré" })
  editerQuestionnaire(@Param("slug") slug: string, @Body() dto: QuestionnaireEditionRequest) {
    return this.adminService.editerQuestionnaire(slug, dto);
  }

  @Delete("questionnaires/:slug")
  @HttpCode(204)
  @ApiOperation({
    summary: "Supprimer un questionnaire",
    description:
      "Les réponses déjà données par les collectivités ne sont PAS supprimées : elles cessent " +
      "simplement d'être lues. Si le questionnaire est recréé sous le même slug, elles reviennent.",
  })
  supprimerQuestionnaire(@Param("slug") slug: string): Promise<void> {
    return this.adminService.supprimerQuestionnaire(slug);
  }

  @Post("simuler")
  // POST parce qu'on envoie un corps, mais une simulation ne CRÉE rien : 200, pas 201.
  @HttpCode(200)
  @ApiOperation({
    summary: "Ce que l'API renverrait pour un projet réel",
    description:
      "Sur un projet EXISTANT — donc sur une vraie classification, avec ses trous. Renvoie TOUS " +
      "les candidats, y compris ceux sous le seuil, avec leur score, les étiquettes partagées et " +
      "le motif de leur sélection : un outil qui n'affiche que les retenus ne permet pas de régler " +
      "le seuil. Les réponses fournies ne sont PAS enregistrées.",
  })
  @ApiEndpointResponses({ successStatus: 200, response: SimulationResponse, description: "Simulation" })
  simuler(@Body() dto: SimulationRequest): Promise<SimulationResponse> {
    return this.adminService.simuler(dto);
  }
}
