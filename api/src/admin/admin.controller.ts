import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ServiceApiKeyGuard } from "@/auth/service-api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { AdminService } from "./admin.service";
import { ContenuResponse, SimulationRequest, SimulationResponse } from "./dto/admin.dto";

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
 * LECTURE et SIMULATION uniquement. Ce module n'écrit rien.
 *
 * L'ÉDITION des questionnaires n'est PAS ici : elle vit dans QuestionnairesModule
 * (questionnaires-admin.controller.ts). C'est l'unique chemin d'écriture, et il porte la validation
 * qui remplace le refus de démarrage — l'héberger dans un module jetable aurait rendu le contenu
 * non éditable le jour où on jette l'écran. La frontière n'est pas « back-office vs reste », c'est
 * « écrire un contenu métier » vs « afficher un écran ».
 *
 * Module ADDITIF et ISOLÉ : rien ne l'importe, il ne modifie rien. `rm -rf src/admin` plus UNE
 * ligne dans app.module.ts, et l'API repart exactement comme avant — questionnaires compris.
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
