import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CustomLogger } from "@logging/logger.service";
import { Aide } from "./dto/aides.dto";

const RETRYABLE_STATUS_CODES = [429, 502, 503, 504];
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000;

/**
 * Client for the Aides-Territoires API
 * Handles authentication (JWT token) and data fetching
 */
@Injectable()
export class AidesTerritoiresService {
  private readonly authToken: string;
  private readonly baseUrl = "https://aides-territoires.beta.gouv.fr/api";
  private bearerToken: string | null = null;
  private bearerExpiresAt = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
  ) {
    this.authToken = this.configService.getOrThrow<string>("AT_API_TOKEN");
  }

  /**
   * Get a valid bearer token, refreshing if expired
   * Token is valid for 24h, we refresh at 23h to avoid edge cases
   */
  private async getBearerToken(): Promise<string> {
    const now = Date.now();
    if (this.bearerToken && now < this.bearerExpiresAt) {
      return this.bearerToken;
    }

    this.logger.log("Refreshing Aides-Territoires bearer token");

    const response = await fetch(`${this.baseUrl}/connexion/`, {
      method: "POST",
      headers: { "X-AUTH-TOKEN": this.authToken },
    });

    if (!response.ok) {
      throw new Error(`AT auth failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { token: string };
    this.bearerToken = data.token;
    this.bearerExpiresAt = now + 23 * 60 * 60 * 1000; // 23h
    return this.bearerToken;
  }

  /**
   * Oublie le bearer token en cache pour forcer une ré-authentification au prochain appel.
   * Notre TTL de 23h n'est qu'une hypothèse : si AT invalide le token plus tôt (rotation,
   * incident, redémarrage côté AT), il faut pouvoir en redemander un sans attendre l'échéance.
   */
  private invalidateBearerToken(): void {
    this.bearerToken = null;
    this.bearerExpiresAt = 0;
  }

  /**
   * Fetch a single page from AT API, robuste aux défaillances d'Aides-Territoires.
   *
   * AT renvoie des 401 de DEUX natures, qu'on traite différemment :
   *   1. token réellement périmé avant notre TTL de 23h → il faut ré-authentifier ;
   *   2. 401 INTERMITTENT sur un token pourtant valide (backend AT flaky : un même token est
   *      accepté puis rejeté à quelques secondes d'intervalle, observé en prod) → il faut
   *      simplement retenter.
   * On combine les deux : au 1er 401/403 on jette le token en cache et on rejoue tout de suite
   * (couvre le cas 1, gratuit) ; si AT continue de renvoyer 401/403, on le traite comme une
   * erreur transitoire (429/5xx) et on retente avec backoff — au lieu de laisser un hoquet d'AT
   * remonter en 500 chez l'appelant.
   */
  private async fetchPage(url: string): Promise<AidesTerritoiresResponse> {
    let reauthed = false;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const token = await this.getBearerToken();
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        return (await response.json()) as AidesTerritoiresResponse;
      }

      const isAuthError = response.status === 401 || response.status === 403;

      // Cas 1 — 1er 401/403 : le token est peut-être périmé. On le jette et on rejoue
      // immédiatement avec un token frais, sans consommer de tentative ni attendre.
      if (isAuthError && !reauthed) {
        reauthed = true;
        this.invalidateBearerToken();
        this.logger.warn(`AT API ${response.status} on ${url}, re-authenticating and retrying`);
        attempt--;
        continue;
      }

      // Cas 2 — 401/403 persistant (AT flaky) ou erreur transitoire (429/5xx) : on retente
      // avec backoff. Tout le reste (4xx applicatif) échoue immédiatement.
      const retryable = isAuthError || RETRYABLE_STATUS_CODES.includes(response.status);
      if (!retryable || attempt === MAX_RETRIES) {
        throw new Error(`AT API error: ${response.status} ${response.statusText}`);
      }

      const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      this.logger.warn(
        `AT API ${response.status} on ${url}, retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }

    // Unreachable, but satisfies TypeScript
    throw new Error("AT API: max retries exhausted");
  }

  /**
   * Fetch aides from AT API with pagination
   * @param params Query parameters (perimeter, targeted_audiences, etc.)
   * @returns All aides matching the query
   */
  async fetchAides(params: Record<string, string> = {}): Promise<Aide[]> {
    const allAides: Aide[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({ ...params, page_size: "50", page: String(page) });
      const url = `${this.baseUrl}/aids/?${queryParams}`;

      const data = await this.fetchPage(url);
      allAides.push(...data.results);

      hasMore = data.next !== null;
      page++;

      // Safety limit
      if (page > 200) {
        this.logger.warn("AT API: reached 200 pages, stopping pagination");
        break;
      }
    }

    this.logger.log(`Fetched ${allAides.length} aides from AT API`);
    return allAides;
  }
}

interface AidesTerritoiresResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Aide[];
}
