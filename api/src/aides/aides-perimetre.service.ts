import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import { AidesCacheService } from "./aides-cache.service";
import { AidesTerritoiresService } from "./aides-territoires.service";
import { Aide } from "./dto/aides.dto";

/**
 * « Quelles aides sont disponibles sur le territoire de ce projet ? »
 *
 * Extrait du contrôleur des aides pour qu'il n'existe qu'UNE définition de cette question. Les
 * ajouts manuels en ont besoin eux aussi : avant d'accepter qu'un agent attache une aide à un
 * projet, on vérifie qu'elle est bien sur son périmètre — sinon on créerait un ajout impossible à
 * résoudre à la lecture, donc invisible, sans le moindre message d'erreur.
 *
 * POURQUOI PAR PÉRIMÈTRE, ET PAS PAR ID. Aides-territoires ne sait PAS récupérer une aide par son
 * identifiant : `/aids/<id>/` répond 404, et `?id=<n>` est silencieusement IGNORÉ — la requête
 * renvoie alors le catalogue entier. Un code qui aurait fait confiance à ce paramètre aurait
 * « marché » en renvoyant n'importe quoi. La seule voie d'accès est la requête par territoire.
 */
@Injectable()
export class AidesPerimetreService {
  /** Clés en cours de rafraîchissement — évite d'empiler N refresh sur la même clé. */
  private readonly refreshingKeys = new Set<string>();

  constructor(
    private readonly atService: AidesTerritoiresService,
    private readonly cacheService: AidesCacheService,
    private readonly logger: CustomLogger,
  ) {}

  /** Codes INSEE des communes du projet. Les autres types de collectivité n'en portent pas. */
  extractCodesInsee(collectivites: { type: string; codeInsee: string | null }[]): string[] {
    const codes: string[] = [];
    for (const c of collectivites) {
      if (c.type === "Commune" && c.codeInsee) {
        codes.push(c.codeInsee);
      }
    }
    return [...new Set(codes)];
  }

  /**
   * Aides de plusieurs territoires (union), dédoublonnées par id.
   *
   * `perimeter_codes[]` accepte n'importe quel code de périmètre (INSEE commune, code
   * département…) directement.
   */
  async fetchAidesForPerimeterCodes(codes: string[]): Promise<Aide[]> {
    if (codes.length === 0) {
      return this.fetchAidesForTerritory({}, "no territory filter");
    }

    const seenIds = new Set<number>();
    const allAides: Aide[] = [];

    for (const code of codes) {
      const aides = await this.fetchAidesForTerritory({ "perimeter_codes[]": code }, `perimeter_code=${code}`);

      for (const aide of aides) {
        if (!seenIds.has(aide.id)) {
          seenIds.add(aide.id);
          allAides.push(aide);
        }
      }
    }

    this.logger.log(`Fetched ${allAides.length} unique aides across ${codes.length} territories`);
    return allAides;
  }

  /**
   * Aides d'un territoire, en stale-while-revalidate : on sert immédiatement ce qu'on a, et on
   * rafraîchit en tâche de fond si c'est périmé.
   */
  async fetchAidesForTerritory(params: Record<string, string>, label: string): Promise<Aide[]> {
    const cacheKey = this.cacheService.buildKey(params);
    const cached = await this.cacheService.get(cacheKey);

    if (cached?.status === "fresh") {
      return cached.aides;
    }

    if (cached?.status === "stale") {
      this.refreshInBackground(cacheKey, params, label);
      return cached.aides;
    }

    this.logger.log(`Cache miss for AT aides, fetching from API (${label})`);
    const aides = await this.atService.fetchAides(params);
    await this.cacheService.set(cacheKey, aides);
    return aides;
  }

  private refreshInBackground(cacheKey: string, params: Record<string, string>, label: string): void {
    if (this.refreshingKeys.has(cacheKey)) return;
    this.refreshingKeys.add(cacheKey);

    this.atService
      .fetchAides(params)
      .then((aides) => this.cacheService.set(cacheKey, aides))
      .then(() => this.logger.log(`Background refresh complete for ${label}`))
      .catch((error) =>
        this.logger.error(`Background refresh failed for ${label}`, {
          error: { message: error instanceof Error ? error.message : "Unknown error" },
        }),
      )
      .finally(() => this.refreshingKeys.delete(cacheKey));
  }
}
