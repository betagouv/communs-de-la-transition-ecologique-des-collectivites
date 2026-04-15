import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CustomLogger } from "@logging/logger.service";

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
   * Fetch aides from AT API with pagination
   * @param params Query parameters (perimeter, targeted_audiences, etc.)
   * @returns All aides matching the query
   */
  async fetchAides(params: Record<string, string> = {}): Promise<AideTerritoires[]> {
    const token = await this.getBearerToken();
    const allAides: AideTerritoires[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({ ...params, page_size: "50", page: String(page) });
      const url = `${this.baseUrl}/aids/?${queryParams}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`AT API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as AidesTerritoiresResponse;
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

/**
 * Shape of an aide from the AT API (subset of 48 fields)
 */
export interface AideTerritoires {
  id: number;
  slug: string;
  url: string;
  name: string;
  name_initial: string;
  short_title: string | null;
  financers: string[];
  financers_full: { id: number; name: string; logo: string | null }[];
  instructors: string[];
  programs: string[];
  description: string | null;
  eligibility: string | null;
  perimeter: string;
  perimeter_id: number;
  perimeter_scale: string;
  categories: string[];
  targeted_audiences: string[];
  aid_types: string[];
  aid_types_full: { id: number; name: string; group: { id: number; name: string } }[];
  mobilization_steps: string[];
  origin_url: string | null;
  application_url: string | null;
  is_call_for_project: boolean | null;
  start_date: string | null;
  submission_deadline: string | null;
  subvention_rate_lower_bound: number | null;
  subvention_rate_upper_bound: number | null;
  subvention_comment: string | null;
  contact: string | null;
  recurrence: string | null;
  project_examples: string | null;
  date_created: string | null;
  date_updated: string | null;
}

interface AidesTerritoiresResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AideTerritoires[];
}
