import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { TerritoiresService, TerritoireProjetsParams } from "./territoires.service";
import { TerritoireProjetsResponse } from "./dto/territoire-projets.dto";
import { PlansTerritoireResponse } from "./dto/plans-territoire.dto";
import { PlansProjetsTerritoireResponse } from "./dto/plans-projets-territoire.dto";
import { QualificationResponse } from "./dto/qualification.dto";

type RawQuery = Record<string, string | string[] | undefined>;

// Première occurrence d'un param (un param répété arrive en tableau via Express).
const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

const toInt = (value: string | undefined, def: number): number => {
  const n = value == null ? NaN : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
};

// Liste de sources : accepte les params répétés (?sources=A&sources=B) ET la forme
// séparée par des virgules (?sources=A,B). Les valeurs de source_origine ne
// contiennent pas de virgule → séparateur sûr.
const toCsvList = (value: string | string[] | undefined): string[] | undefined => {
  if (value == null) return undefined;
  const arr = (Array.isArray(value) ? value : [value])
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length > 0 ? arr : undefined;
};

// Paramètres de filtrage communs aux deux vues territoriales (territoires/:code/projets et
// plans/:cle/projets-territoire) : même sémantique, mêmes bornes (limit 1..200, défaut 50).
const parseProjetsParams = (query: RawQuery): TerritoireProjetsParams => ({
  sources: toCsvList(query.sources),
  copMillesime: first(query.copMillesime),
  copStatutVivier: first(query.copStatutVivier),
  // limit borné à 1..200 (limit=0 interdit).
  limit: Math.min(Math.max(toInt(first(query.limit), 50), 1), 200),
  offset: toInt(first(query.offset), 0),
  inclureFinancementsSeuls: first(query.inclureFinancementsSeuls) === "true",
  masquerObsoletes: first(query.masquerObsoletes) === "true",
});

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
      "code = INSEE commune (5 chiffres ou 2A/2B+3) ou SIREN EPCI (9 chiffres, développé en ses communes membres). " +
      "Les groupes rassemblent toutes les traces d'un même projet réel (MEC, Vivier COP, financements DGCL/Fonds Vert…). " +
      "NB : les traces TeT (fiches action) ne sont pas exposées en V1 — source_origine='TeT' n'existe pas côté projets. " +
      "Aucun identifiant de groupe n'est exposé (les cluster_id sont instables).",
  })
  @ApiQuery({
    name: "sources",
    required: false,
    description: "Sources (répétables ou séparées par des virgules), ex. MEC,Vivier COP.",
  })
  @ApiQuery({ name: "copMillesime", required: false, enum: ["2024", "2025"] })
  @ApiQuery({
    name: "copStatutVivier",
    required: false,
    enum: ["a_remonter", "a_travailler", "hors_cop_mais_crte", "non_remonte"],
    description: "Statut vivier COP (cop_statut_vivier).",
  })
  @ApiQuery({ name: "limit", required: false, description: "Défaut 50, borné à 1..200." })
  @ApiQuery({ name: "offset", required: false, description: "Défaut 0." })
  @ApiQuery({
    name: "inclureFinancementsSeuls",
    required: false,
    description: "Inclure les groupes dont toutes les traces sont des financements (défaut false).",
  })
  @ApiQuery({
    name: "masquerObsoletes",
    required: false,
    description:
      "Exclure les groupes dont une trace est marquée obsolète (décision active projet_statut, verdict 'obsolete'). Défaut false.",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: TerritoireProjetsResponse,
    description: "Groupes de projets du territoire",
  })
  territoireProjets(
    @Req() request: Request,
    @Param("code") code: string,
    @Query() query: RawQuery,
  ): Promise<TerritoireProjetsResponse> {
    // serviceType dérivé de la clé API (doctrine d'accès : résout les scopes du service).
    return this.territoiresService.territoireProjets(code, parseProjetsParams(query), request.serviceType!);
  }

  @TrackApiUsage()
  @Get("plans/:cle/projets-territoire")
  @ApiOperation({
    summary: "Projets du territoire couvert par un PCAET (miroir TeT), avec rattachement par groupe",
    description:
      "cle = SIREN du porteur du PCAET (clé stable, 9 chiffres) ou un plan_id de la référence " +
      "(opendata/snapshot/live), résolu vers la même fiche. 404 si la clé ne résout aucun PCAET. " +
      "Renvoie les projets des communes couvertes, regroupés par cluster (même mécanique que " +
      "territoires/:code/projets — traces, confiance, decisions[]), plus par groupe un champ " +
      "`rattachement` (confirme|infirme|suggere|aucun) vis-à-vis de CE PCAET. Pour rattacher un " +
      "projet, poster une décision rattachement_pcaet sur POST /decisions (objetA = trace du groupe, " +
      "objetB = SIREN porteur).",
  })
  @ApiQuery({
    name: "sources",
    required: false,
    description: "Sources (répétables ou séparées par des virgules), ex. MEC,Vivier COP.",
  })
  @ApiQuery({ name: "copMillesime", required: false, enum: ["2024", "2025"] })
  @ApiQuery({
    name: "copStatutVivier",
    required: false,
    enum: ["a_remonter", "a_travailler", "hors_cop_mais_crte", "non_remonte"],
    description: "Statut vivier COP (cop_statut_vivier).",
  })
  @ApiQuery({ name: "limit", required: false, description: "Défaut 50, borné à 1..200." })
  @ApiQuery({ name: "offset", required: false, description: "Défaut 0." })
  @ApiQuery({
    name: "inclureFinancementsSeuls",
    required: false,
    description: "Inclure les groupes dont toutes les traces sont des financements (défaut false).",
  })
  @ApiQuery({
    name: "masquerObsoletes",
    required: false,
    description:
      "Exclure les groupes dont une trace est marquée obsolète (décision active projet_statut, verdict 'obsolete'). Défaut false.",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: PlansProjetsTerritoireResponse,
    description: "Projets du territoire du PCAET, avec rattachement par groupe",
  })
  plansProjetsTerritoire(
    @Req() request: Request,
    @Param("cle") cle: string,
    @Query() query: RawQuery,
  ): Promise<PlansProjetsTerritoireResponse> {
    return this.territoiresService.plansProjetsTerritoire(cle, parseProjetsParams(query), request.serviceType!);
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
