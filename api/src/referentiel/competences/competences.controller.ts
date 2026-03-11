import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { CompetencesService } from "./competences.service";
import { CompetenceGroupementsQueryDto } from "./dto/competence-query.dto";
import { CompetenceCategorieResponse, CompetenceResponse } from "./dto/competence.response";
import { GroupementResponse } from "../groupements/dto/groupement.response";

@Controller("v1/competences")
@ApiTags("Référentiel - Compétences")
export class CompetencesController {
  constructor(private readonly competencesService: CompetencesService) {}

  @Get()
  @ApiOperation({ summary: "Lister les compétences" })
  @ApiQuery({ name: "categorie", required: false, description: "Filtrer par code catégorie" })
  @ApiEndpointResponses({ successStatus: 200, response: CompetenceResponse, isArray: true })
  findAll(@Query("categorie") categorie?: string): Promise<CompetenceResponse[]> {
    return this.competencesService.findAll(categorie);
  }

  @Get("categories")
  @ApiOperation({ summary: "Lister les catégories de compétences" })
  @ApiEndpointResponses({ successStatus: 200, response: CompetenceCategorieResponse, isArray: true })
  findAllCategories(): Promise<CompetenceCategorieResponse[]> {
    return this.competencesService.findAllCategories();
  }

  @Get(":code")
  @ApiOperation({ summary: "Détail d'une compétence" })
  @ApiParam({ name: "code", description: "Code compétence Banatic", example: "1505" })
  @ApiEndpointResponses({ successStatus: 200, response: CompetenceResponse })
  findOne(@Param("code") code: string): Promise<CompetenceResponse> {
    return this.competencesService.findOne(code);
  }

  @Get(":code/groupements")
  @ApiOperation({ summary: "Groupements exerçant une compétence" })
  @ApiParam({ name: "code", description: "Code compétence Banatic", example: "1505" })
  @ApiEndpointResponses({ successStatus: 200, response: GroupementResponse, isArray: true })
  getGroupements(
    @Param("code") code: string,
    @Query() query: CompetenceGroupementsQueryDto,
  ): Promise<GroupementResponse[]> {
    return this.competencesService.getGroupements(code, query);
  }
}
