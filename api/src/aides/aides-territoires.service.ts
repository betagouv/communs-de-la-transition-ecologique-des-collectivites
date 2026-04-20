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
   * Fetch a single page from AT API with retry on transient errors (429, 502, 503, 504).
   */
  private async fetchPage(url: string, token: string): Promise<AidesTerritoiresResponse> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        return (await response.json()) as AidesTerritoiresResponse;
      }

      if (!RETRYABLE_STATUS_CODES.includes(response.status) || attempt === MAX_RETRIES) {
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
    const token = await this.getBearerToken();
    const allAides: Aide[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({ ...params, page_size: "50", page: String(page) });
      const url = `${this.baseUrl}/aids/?${queryParams}`;

      const data = await this.fetchPage(url, token);
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
