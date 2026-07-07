import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { TerritoiresService } from "./territoires.service";
import { TerritoireProjetsResponse } from "./dto/territoire-projets.dto";
import { PlansTerritoireResponse } from "./dto/plans-territoire.dto";
import { QualificationResponse } from "./dto/qualification.dto";

const toInt = (value: string | undefined, def: number): number => {
  const n = value == null ? NaN : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
};

// Découpe une valeur en liste par virgule (camelCase, ex. ?sources=MEC,TeT,Vivier COP).
// Les valeurs de source_origine ne contiennent pas de virgule → séparateur sûr.
const toCsvList = (value: string | undefined): string[] | undefined => {
  if (value == null) return undefined;
  const arr = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length > 0 ? arr : undefined;
};

@ApiBearerAuth()
@ApiTags("Territoires")
@Controller()
@UseGuards(ApiKeyGuard)
export class TerritoiresController {
  constructor(private readonly territoiresService: TerritoiresService) {}

  @TrackApiUsage()
  @Get("territoires/:code/projets")
  @ApiOperation({
    summary: "Projets d'un territoire, regroupés par cluster de déduplication",
    description:
      "code = INSEE commune (5 chiffres) ou SIREN EPCI (9 chiffres, développé en ses communes membres). " +
      "Les groupes rassemblent toutes les traces d'un même projet réel (MEC, TeT, Vivier COP, financements…). " +
      "Aucun identifiant de groupe n'est exposé (les cluster_id sont instables).",
  })
  @ApiQuery({
    name: "sources",
    required: false,
    description: "Sources séparées par des virgules (ex. MEC,TeT,Vivier COP).",
  })
  @ApiQuery({ name: "copMillesime", required: false, enum: ["2024", "2025"] })
  @ApiQuery({ name: "statut", required: false, description: "Statut vivier COP (cop_statut_vivier)." })
  @ApiQuery({ name: "limit", required: false, description: "Défaut 50, max 200." })
  @ApiQuery({ name: "offset", required: false, description: "Défaut 0." })
  @ApiQuery({
    name: "inclureFinancementsSeuls",
    required: false,
    description: "Inclure les groupes dont toutes les traces sont des financements (défaut false).",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: TerritoireProjetsResponse,
    description: "Groupes de projets du territoire",
  })
  territoireProjets(
    @Param("code") code: string,
    @Query("sources") sources?: string,
    @Query("copMillesime") copMillesime?: string,
    @Query("statut") statut?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("inclureFinancementsSeuls") inclureFinancementsSeuls?: string,
  ): Promise<TerritoireProjetsResponse> {
    return this.territoiresService.territoireProjets(code, {
      sources: toCsvList(sources),
      copMillesime,
      statut,
      limit: Math.min(toInt(limit, 50), 200),
      offset: toInt(offset, 0),
      inclureFinancementsSeuls: inclureFinancementsSeuls === "true",
    });
  }

  @TrackApiUsage()
  @Get("projets/mec/:externalId/plans-territoire")
  @ApiOperation({
    summary: "PCAET couvrant le territoire d'un projet MEC",
    description: "Résout l'external_id MEC (404 si inconnu), puis liste les PCAET couvrant les communes du projet.",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: PlansTerritoireResponse,
    description: "PCAET du territoire du projet",
  })
  plansTerritoire(@Param("externalId") externalId: string): Promise<PlansTerritoireResponse> {
    return this.territoiresService.planFichesTerritoire(externalId);
  }

  @TrackApiUsage()
  @Get("projets/mec/:externalId/qualification")
  @ApiOperation({
    summary: "Qualification LLM d'un projet MEC",
    description: "Résout l'external_id MEC (404 si inconnu), puis retourne leviers, thématiques, probabilité TE.",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: QualificationResponse,
    description: "Qualification du projet",
  })
  qualification(@Param("externalId") externalId: string): Promise<QualificationResponse> {
    return this.territoiresService.qualification(externalId);
  }
}
