import { Injectable, NotFoundException } from "@nestjs/common";
import { sql, eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { refCommunes, refPerimetres, refGroupements } from "@database/schema";
import { CommuneQueryDto } from "./dto/commune-query.dto";
import { CommuneResponse, CommuneDetailResponse, GroupementSummary } from "./dto/commune.response";
import { CompetenceAvecGroupementResponse } from "../competences/dto/competence.response";

@Injectable()
export class CommunesService {
  constructor(private readonly dbService: DatabaseService) {}

  async search(query: CommuneQueryDto): Promise<CommuneResponse[]> {
    // Direct lookup by code or siren
    if (query.codeInsee) {
      return this.findByField("code_insee", query.codeInsee);
    }
    if (query.siren) {
      return this.findByField("siren", query.siren);
    }

    // Text search with pg_trgm
    if (query.q) {
      return this.searchByName(query.q, query);
    }

    // Filter-only query
    return this.findWithFilters(query);
  }

  async findOne(codeInsee: string): Promise<CommuneDetailResponse> {
    const commune = await this.dbService.database.query.refCommunes.findFirst({
      where: eq(refCommunes.codeInsee, codeInsee),
    });

    if (!commune) {
      throw new NotFoundException(`Commune ${codeInsee} non trouvée`);
    }

    // Get groupements via perimetres
    const groupements = await this.dbService.database
      .select({
        siren: refGroupements.siren,
        nom: refGroupements.nom,
        type: refGroupements.type,
      })
      .from(refPerimetres)
      .innerJoin(refGroupements, eq(refPerimetres.sirenGroupement, refGroupements.siren))
      .where(eq(refPerimetres.codeInseeCommune, codeInsee));

    return {
      code: commune.codeInsee,
      nom: commune.nom,
      siren: commune.siren,
      codeEpci: commune.codeEpci ?? null,
      codeDepartement: commune.codeDepartement ?? "",
      codeRegion: commune.codeRegion ?? "",
      population: commune.population ?? null,
      codesPostaux: commune.codesPostaux ?? null,
      groupements: groupements as GroupementSummary[],
    };
  }

  async getCompetences(codeInsee: string): Promise<CompetenceAvecGroupementResponse[]> {
    // Verify commune exists
    const commune = await this.dbService.database.query.refCommunes.findFirst({
      where: eq(refCommunes.codeInsee, codeInsee),
    });
    if (!commune) {
      throw new NotFoundException(`Commune ${codeInsee} non trouvée`);
    }

    const results = await this.dbService.database.execute(sql`
      SELECT
        c.code AS competence_code,
        c.nom AS competence_nom,
        cc.code AS categorie_code,
        cc.nom AS categorie_nom,
        g.siren AS groupement_siren,
        g.nom AS groupement_nom,
        g.type AS groupement_type
      FROM ref_perimetres p
      JOIN ref_groupements g ON g.siren = p.siren_groupement
      JOIN ref_groupement_competences gc ON gc.siren_groupement = g.siren
      JOIN ref_competences c ON c.code = gc.code_competence
      JOIN ref_competence_categories cc ON cc.code = c.code_categorie
      WHERE p.code_insee_commune = ${codeInsee}
      ORDER BY cc.code, c.code
    `);

    return results.rows.map((row: Record<string, unknown>) => ({
      competence: {
        code: row.competence_code as string,
        nom: row.competence_nom as string,
        categorie: { code: row.categorie_code as string, nom: row.categorie_nom as string },
      },
      groupement: {
        siren: row.groupement_siren as string,
        nom: row.groupement_nom as string,
        type: row.groupement_type as string,
      },
    }));
  }

  private async searchByName(q: string, query: CommuneQueryDto): Promise<CommuneResponse[]> {
    const normalized = q.trim();
    if (!normalized) return [];

    const conditions = [sql`word_similarity(normalize_search(${normalized}), normalize_search(nom)) > 0.3`];
    if (query.codeDepartement) {
      conditions.push(sql`code_departement = ${query.codeDepartement}`);
    }
    if (query.codeEpci) {
      conditions.push(sql`code_epci = ${query.codeEpci}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    const results = await this.dbService.database.execute(sql`
      SELECT
        code_insee AS "code",
        nom,
        siren,
        code_epci AS "codeEpci",
        code_departement AS "codeDepartement",
        code_region AS "codeRegion",
        population,
        codes_postaux AS "codesPostaux",
        word_similarity(normalize_search(${normalized}), normalize_search(nom)) AS score
      FROM ref_communes
      WHERE ${whereClause}
      ORDER BY score DESC, population DESC NULLS LAST
      LIMIT ${query.limit ?? 20}
      OFFSET ${query.offset ?? 0}
    `);

    return results.rows as unknown as CommuneResponse[];
  }

  private async findByField(field: string, value: string): Promise<CommuneResponse[]> {
    const results = await this.dbService.database.execute(sql`
      SELECT
        code_insee AS "code",
        nom,
        siren,
        code_epci AS "codeEpci",
        code_departement AS "codeDepartement",
        code_region AS "codeRegion",
        population,
        codes_postaux AS "codesPostaux"
      FROM ref_communes
      WHERE ${sql.identifier(field)} = ${value}
    `);
    return results.rows as unknown as CommuneResponse[];
  }

  private async findWithFilters(query: CommuneQueryDto): Promise<CommuneResponse[]> {
    const conditions: ReturnType<typeof sql>[] = [];

    if (query.codeDepartement) {
      conditions.push(sql`code_departement = ${query.codeDepartement}`);
    }
    if (query.codeEpci) {
      conditions.push(sql`code_epci = ${query.codeEpci}`);
    }

    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const results = await this.dbService.database.execute(sql`
      SELECT
        code_insee AS "code",
        nom,
        siren,
        code_epci AS "codeEpci",
        code_departement AS "codeDepartement",
        code_region AS "codeRegion",
        population,
        codes_postaux AS "codesPostaux"
      FROM ref_communes
      ${whereClause}
      ORDER BY population DESC NULLS LAST
      LIMIT ${query.limit ?? 20}
      OFFSET ${query.offset ?? 0}
    `);

    return results.rows as unknown as CommuneResponse[];
  }
}
