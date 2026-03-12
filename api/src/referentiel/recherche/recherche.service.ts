import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { RechercheQueryDto } from "./dto/recherche-query.dto";
import { RechercheResponse, RechercheResultItem } from "./dto/recherche.response";

@Injectable()
export class RechercheService {
  constructor(private readonly dbService: DatabaseService) {}

  async search(query: RechercheQueryDto): Promise<RechercheResponse> {
    const normalized = query.q.trim();
    const limit = query.limit ?? 5;

    const result: RechercheResponse = { communes: [], groupements: [] };

    if (!normalized) return result;

    const searchCommunes = !query.famille || query.famille === "commune";
    const searchGroupements = !query.famille || query.famille === "groupement";

    if (searchCommunes) {
      const communeResults = await this.dbService.database.execute(sql`
        SELECT
          code_insee AS id,
          nom,
          'COM' AS type,
          'commune' AS famille,
          word_similarity(normalize_search(${normalized}), normalize_search(nom)) AS score
        FROM api_referentiel.communes
        WHERE word_similarity(normalize_search(${normalized}), normalize_search(nom)) > 0.3
        ORDER BY score DESC, population DESC NULLS LAST
        LIMIT ${limit}
      `);
      result.communes = communeResults.rows as unknown as RechercheResultItem[];
    }

    if (searchGroupements) {
      const groupementResults = await this.dbService.database.execute(sql`
        SELECT
          siren AS id,
          nom,
          type,
          'groupement' AS famille,
          word_similarity(normalize_search(${normalized}), normalize_search(nom)) AS score
        FROM api_referentiel.groupements
        WHERE word_similarity(normalize_search(${normalized}), normalize_search(nom)) > 0.3
        ORDER BY score DESC, population DESC NULLS LAST
        LIMIT ${limit}
      `);
      result.groupements = groupementResults.rows as unknown as RechercheResultItem[];
    }

    return result;
  }
}
