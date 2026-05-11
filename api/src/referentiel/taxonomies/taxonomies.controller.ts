import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { sites } from "@/projet-qualification/classification/const/sites";
import { thematiques } from "@/projet-qualification/classification/const/thematiques";
import { interventions } from "@/projet-qualification/classification/const/interventions";
import { leviers } from "@/shared/const/leviers";

@Controller("referentiel/v1")
@ApiTags("Référentiel - Taxonomies")
export class TaxonomiesController {
  @Get("sites")
  @ApiOperation({ summary: "Lister les sites de la taxonomie de classification" })
  getSites(): { items: readonly string[] } {
    return { items: sites };
  }

  @Get("thematiques")
  @ApiOperation({ summary: "Lister les thématiques de la taxonomie de classification" })
  getThematiques(): { items: readonly string[] } {
    return { items: thematiques };
  }

  @Get("interventions")
  @ApiOperation({ summary: "Lister les interventions de la taxonomie de classification" })
  getInterventions(): { items: readonly string[] } {
    return { items: interventions };
  }

  @Get("leviers")
  @ApiOperation({ summary: "Lister les leviers SGPE" })
  getLeviers(): { items: readonly string[] } {
    return { items: leviers };
  }
}
