import { applyDecorators, Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { ConsultationService, ProjetsParams } from "./consultation.service";
import { parseMillesime } from "./consultation-projection";
import { ProjetsCollectiviteResponse, ProjetsConsultationResponse } from "./dto/projet-consultation.dto";
import { SyntheseCollectiviteResponse } from "./dto/synthese.dto";
import { CollectivitesConsultationResponse } from "./dto/collectivites.dto";

type RawQuery = Record<string, string | string[] | undefined>;

// First occurrence of a param (a repeated param arrives as an array through Express).
const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

const toLimit = (value: string | undefined, def: number, max: number): number => {
  const n = value == null ? NaN : Number(value);
  return Math.min(Math.max(Number.isFinite(n) ? Math.floor(n) : def, 1), max);
};

const nonEmpty = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
};

// The bulk read serves nightly snapshots: bigger pages keep a full run within the rate limit.
const BULK_LIMIT = { def: 200, max: 1000 };
const LIMIT = { def: 50, max: 200 };

const parseProjetsParams = (query: RawQuery, bounds: { def: number; max: number }): ProjetsParams => ({
  source: nonEmpty(first(query.source)),
  nature: nonEmpty(first(query.nature)),
  thematique: nonEmpty(first(query.thematique)),
  millesime: parseMillesime(nonEmpty(first(query.millesime))),
  limit: toLimit(first(query.limit), bounds.def, bounds.max),
  cursor: nonEmpty(first(query.cursor)),
});

const REGIME =
  "Accès restreint aux services de l'État (clé d'API dédiée), en lecture seule. Ce n'est pas un jeu de données ouvert.";

const PROJET =
  "Chaque projet suit le schéma commun v0.2.0, complété d'un bloc `labels` (provisoire : seuil de classification non calibré) " +
  "et de ses `financements`. Les doublons exacts (même collectivité, même intitulé) sont regroupés à la lecture, sans perte : " +
  "`sources` liste toutes les lignes d'origine. `sources` (source + idSource) est la référence à conserver : " +
  "aucun identifiant interne n'est exposé.";

const FILTRES =
  "Un projet regroupé est retenu dès qu'une de ses lignes satisfait tous les filtres. " +
  "Le filtre `nature` est indicatif : la classification de la nature n'est pas encore fiable.";

const ProjetsFiltersQueries = () =>
  applyDecorators(
    ApiQuery({ name: "source", required: false, description: "Source de données, ex. dgcl, fonds-vert, agences-eau." }),
    ApiQuery({ name: "nature", required: false, description: "Nature (indicatif), ex. Projet opérationnel." }),
    ApiQuery({ name: "millesime", required: false, description: "Année d'attribution d'un financement, ex. 2024." }),
    ApiQuery({ name: "thematique", required: false, description: "Thématique (label provisoire), valeur exacte." }),
    ApiQuery({ name: "cursor", required: false, description: "Valeur `nextCursor` de la page précédente." }),
  );

@ApiBearerAuth()
@ApiTags("Consultation")
@Controller()
@UseGuards(ApiKeyGuard)
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  @TrackApiUsage()
  @Get("consultation/v1/projets")
  @ApiOperation({
    summary: "Tous les projets de la base consolidée, paginés par curseur",
    description:
      `${REGIME} Lecture en masse de toutes les sources, pour constituer un instantané. ${PROJET} ${FILTRES} ` +
      "Parcours : appeler sans `cursor`, puis repasser `nextCursor` jusqu'à obtenir null. Le curseur vaut pour un parcours ; " +
      "la base étant reconstruite périodiquement, un parcours interrompu se reprend du début. " +
      "L'API est limitée à 50 requêtes par minute et par adresse IP.",
  })
  @ProjetsFiltersQueries()
  @ApiQuery({ name: "limit", required: false, description: "Défaut 200, borné à 1..1000." })
  @ApiEndpointResponses({ successStatus: 200, response: ProjetsConsultationResponse, description: "Page de projets" })
  projets(@Query() query: RawQuery): Promise<ProjetsConsultationResponse> {
    return this.consultationService.projets(parseProjetsParams(query, BULK_LIMIT));
  }

  @TrackApiUsage()
  @Get("consultation/v1/collectivites/:siren/projets")
  @ApiOperation({
    summary: "Projets portés par une collectivité",
    description: `${REGIME} siren = SIREN de la collectivité responsable (9 chiffres). ${PROJET} ${FILTRES}`,
  })
  @ProjetsFiltersQueries()
  @ApiQuery({ name: "limit", required: false, description: "Défaut 50, borné à 1..200." })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjetsCollectiviteResponse,
    description: "Page de projets de la collectivité",
  })
  projetsCollectivite(@Param("siren") siren: string, @Query() query: RawQuery): Promise<ProjetsCollectiviteResponse> {
    return this.consultationService.projetsCollectivite(siren, parseProjetsParams(query, LIMIT));
  }

  @TrackApiUsage()
  @Get("consultation/v1/collectivites/:siren/synthese")
  @ApiOperation({
    summary: "Synthèse financière et thématique d'une collectivité",
    description:
      `${REGIME} Agrégats pour une fiche collectivité : montants attribués par source de financement et par année, ` +
      "répartition par thématique, taux de financement. Les montants sont calculés sur les lignes de financement " +
      "(statut Obtenu ou Payé). `completudeParSource` et `avertissements` signalent les sources incomplètes " +
      "(Fonds Vert notamment) : à lire avant d'interpréter les totaux. Thématiques issues de labels provisoires.",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: SyntheseCollectiviteResponse,
    description: "Synthèse de la collectivité",
  })
  synthese(@Param("siren") siren: string): Promise<SyntheseCollectiviteResponse> {
    return this.consultationService.synthese(siren);
  }

  @TrackApiUsage()
  @Get("consultation/v1/collectivites")
  @ApiOperation({
    summary: "Collectivités d'un département ou d'une région, avec indicateurs comparables",
    description:
      `${REGIME} Liste les communes et groupements du territoire (référentiel des collectivités), y compris ceux sans projet, ` +
      "avec pour chacun le nombre de projets, les montants attribués et les principales thématiques (labels provisoires). " +
      "Un groupement est rattaché au territoire dès qu'une de ses communes membres s'y trouve. " +
      "Les indicateurs portent sur tous les projets dont la collectivité est responsable. " +
      "Départements, régions et syndicats hors référentiel ne sont pas listés.",
  })
  @ApiQuery({ name: "departement", required: false, description: "Code INSEE du département, ex. 59, 2A, 974." })
  @ApiQuery({ name: "region", required: false, description: "Code INSEE de la région, ex. 32." })
  @ApiQuery({ name: "limit", required: false, description: "Défaut 50, borné à 1..200." })
  @ApiQuery({ name: "cursor", required: false, description: "Valeur `nextCursor` de la page précédente." })
  @ApiEndpointResponses({
    successStatus: 200,
    response: CollectivitesConsultationResponse,
    description: "Page de collectivités",
  })
  collectivites(@Query() query: RawQuery): Promise<CollectivitesConsultationResponse> {
    return this.consultationService.collectivites({
      departement: nonEmpty(first(query.departement)),
      region: nonEmpty(first(query.region)),
      limit: toLimit(first(query.limit), LIMIT.def, LIMIT.max),
      cursor: nonEmpty(first(query.cursor)),
    });
  }
}
