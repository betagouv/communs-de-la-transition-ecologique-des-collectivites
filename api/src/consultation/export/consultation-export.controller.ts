import { Controller, Get, Redirect, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { ConsultationExportService } from "./consultation-export.service";
import { ExportFichierResponse } from "./consultation-export.dto";

const EXPORT =
  "Export complet de la base consolidée, régénéré chaque nuit à partir de 03:00 UTC (04:00 à Paris en hiver, " +
  "05:00 en été) : un fichier JSON Lines compressé en gzip, un projet par ligne, au même format que " +
  "`GET /consultation/v1/projets` et avec les mêmes règles d'accès. Un service habilité aux données internes à " +
  "l'État reçoit le fichier `interne_etat` ; les autres reçoivent le fichier `opendata`, limité aux lignes " +
  "`ouvert`. Les provenances restreintes sont exclues des deux fichiers.";

@ApiBearerAuth()
@ApiTags("Consultation")
@Controller()
@UseGuards(ApiKeyGuard)
export class ConsultationExportController {
  constructor(private readonly exportService: ConsultationExportService) {}

  @TrackApiUsage()
  @Get("consultation/v1/export")
  @Redirect()
  @ApiOperation({
    summary: "Télécharger l'export complet de la base consolidée",
    description:
      `${EXPORT} Répond par une redirection vers le fichier (lien valable 15 minutes), ` +
      "ex. `curl -L -H 'Authorization: Bearer <clé>' <api>/consultation/v1/export -o projets.ndjson.gz`.",
  })
  @ApiResponse({ status: 302, description: "Redirection vers le fichier" })
  @ApiResponse({ status: 503, description: "Export pas encore généré ou indisponible dans cet environnement" })
  async telecharger(@Req() request: Request): Promise<{ url: string; statusCode: number }> {
    const { url } = await this.exportService.fichier(request.serviceType!);
    return { url, statusCode: 302 };
  }

  @TrackApiUsage()
  @Get("consultation/v1/export/description")
  @ApiOperation({
    summary: "Décrire l'export complet : date de génération, taille, empreinte et lien",
    description: `${EXPORT} Permet de vérifier la fraîcheur du fichier avant de le télécharger.`,
  })
  @ApiEndpointResponses({ successStatus: 200, response: ExportFichierResponse, description: "Fichier d'export" })
  description(@Req() request: Request): Promise<ExportFichierResponse> {
    return this.exportService.fichier(request.serviceType!);
  }
}
