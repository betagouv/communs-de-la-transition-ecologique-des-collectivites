import { Body, Controller, Delete, Get, HttpCode, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ServiceApiKeyGuard } from "@/auth/service-api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { interventions } from "@/projet-qualification/classification/const/interventions";
import { sites } from "@/projet-qualification/classification/const/sites";
import { thematiques } from "@/projet-qualification/classification/const/thematiques";
import { QuestionnairesRepository } from "./questionnaires.repository";
import { QuestionnaireEditionRequest, TaxonomiesResponse } from "./dto/questionnaire-edition.dto";

/**
 * ÉCRITURE des questionnaires. Vit ici, dans le module des questionnaires, et non dans `src/admin`.
 *
 * POURQUOI. Le back-office doit rester supprimable sans amputer l'API — c'était la contrainte. Or
 * ceci est l'UNIQUE chemin d'écriture, et c'est lui qui porte la validation qui remplace le refus
 * de démarrage qu'on avait quand les questionnaires vivaient dans le dépôt. L'héberger dans un
 * module jetable, c'était rendre le contenu non éditable le jour où on jette l'écran.
 *
 * La bonne frontière n'est pas « back-office vs reste » : c'est « écrire un contenu métier » vs
 * « afficher un écran ». L'écriture appartient au domaine, à côté de la lecture. `src/admin` ne
 * garde que la SIMULATION — son vrai propos — et redevient réellement jetable.
 *
 * Derrière `ServiceApiKeyGuard` : c'est le garde d'administration, jamais une clé de plateforme
 * partenaire. Éditer un questionnaire n'est pas un droit de MEC.
 */
@ApiBearerAuth()
@ApiTags("Administration")
@Controller("admin")
@UseGuards(ServiceApiKeyGuard)
export class QuestionnairesAdminController {
  constructor(private readonly repository: QuestionnairesRepository) {}

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
    return { thematiques: [...thematiques], sites: [...sites], interventions: [...interventions] };
  }

  @Put("questionnaires/:slug")
  @ApiOperation({
    summary: "Créer ou remplacer un questionnaire",
    description:
      "PUT, pas PATCH : un éditeur envoie le document qu'il a sous les yeux. Un PATCH champ par " +
      "champ autoriserait des états incohérents entre deux appels — une condition enregistrée avant " +
      "la question qu'elle vise.\n\n" +
      "Tout est revalidé avant écriture, et un écart est un 400 explicite (cf. validerDefinition).\n\n" +
      "La `version` s'incrémente automatiquement. Elle n'invalide rien : les réponses des " +
      "collectivités devenues sans objet sont ignorées à la lecture, jamais effacées.",
  })
  editer(@Param("slug") slug: string, @Body() dto: QuestionnaireEditionRequest) {
    return this.repository.enregistrer(
      {
        slug,
        source: { nom: dto.sourceNom },
        banniere: dto.banniere,
        questions: dto.questions,
        recommandations: dto.recommandations,
        etiquettesRequises: dto.etiquettesRequises,
      },
      dto.editePar,
    );
  }

  @Delete("questionnaires/:slug")
  @HttpCode(204)
  @ApiOperation({
    summary: "Supprimer un questionnaire",
    description:
      "Les réponses déjà données par les collectivités ne sont PAS supprimées : elles cessent " +
      "simplement d'être lues. Si le questionnaire est recréé sous le même slug, elles reviennent.",
  })
  supprimer(@Param("slug") slug: string): Promise<void> {
    return this.repository.supprimer(slug);
  }
}
