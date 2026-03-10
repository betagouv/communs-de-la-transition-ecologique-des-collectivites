import { Injectable, NotFoundException } from "@nestjs/common";
import { sql, eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import {
  refGroupements,
  refPerimetres,
  refCommunes,
  refGroupementCompetences,
  refCompetences,
  refCompetenceCategories,
} from "@database/schema";
import { GroupementQueryDto } from "./dto/groupement-query.dto";
import { GroupementResponse, MembreResponse } from "./dto/groupement.response";
import { CompetenceResponse } from "../competences/dto/competence.response";

@Injectable()
export class GroupementsService {
  constructor(private readonly dbService: DatabaseService) {}

  async search(query: GroupementQueryDto): Promise<GroupementResponse[]> {
    if (query.siren) {
      return this.findBySiren(query.siren);
    }
    if (query.siret) {
      return this.findBySiren(query.siret.substring(0, 9));
    }
    if (query.q) {
      return this.searchByName(query.q, query);
    }
    return this.findWithFilters(query);
  }

  async findOne(siren: string): Promise<GroupementResponse> {
    const groupement = await this.dbService.database.query.refGroupements.findFirst({
      where: eq(refGroupements.siren, siren),
    });

    if (!groupement) {
      throw new NotFoundException(`Groupement ${siren} non trouvé`);
    }

    return this.mapGroupement(groupement);
  }

  async getMembres(siren: string): Promise<MembreResponse[]> {
    const groupement = await this.dbService.database.query.refGroupements.findFirst({
      where: eq(refGroupements.siren, siren),
    });
    if (!groupement) {
      throw new NotFoundException(`Groupement ${siren} non trouvé`);
    }

    const results = await this.dbService.database
      .select({
        code: refCommunes.codeInsee,
        nom: refCommunes.nom,
        population: refCommunes.population,
        categorieMembre: refPerimetres.categorieMembre,
      })
      .from(refPerimetres)
      .innerJoin(refCommunes, eq(refPerimetres.codeInseeCommune, refCommunes.codeInsee))
      .where(eq(refPerimetres.sirenGroupement, siren))
      .orderBy(refCommunes.nom);

    return results.map((r) => ({
      code: r.code,
      nom: r.nom,
      population: r.population ?? null,
      categorieMembre: r.categorieMembre ?? "commune",
    }));
  }

  async getCompetences(siren: string): Promise<CompetenceResponse[]> {
    const groupement = await this.dbService.database.query.refGroupements.findFirst({
      where: eq(refGroupements.siren, siren),
    });
    if (!groupement) {
      throw new NotFoundException(`Groupement ${siren} non trouvé`);
    }

    const results = await this.dbService.database
      .select({
        code: refCompetences.code,
        nom: refCompetences.nom,
        categorieCode: refCompetenceCategories.code,
        categorieNom: refCompetenceCategories.nom,
      })
      .from(refGroupementCompetences)
      .innerJoin(refCompetences, eq(refGroupementCompetences.codeCompetence, refCompetences.code))
      .innerJoin(refCompetenceCategories, eq(refCompetences.codeCategorie, refCompetenceCategories.code))
      .where(eq(refGroupementCompetences.sirenGroupement, siren))
      .orderBy(refCompetenceCategories.code, refCompetences.code);

    return results.map((r) => ({
      code: r.code,
      nom: r.nom,
      categorie: { code: r.categorieCode, nom: r.categorieNom },
    }));
  }

  private async findBySiren(siren: string): Promise<GroupementResponse[]> {
    const results = await this.dbService.database.query.refGroupements.findMany({
      where: eq(refGroupements.siren, siren),
    });
    return results.map((g) => this.mapGroupement(g));
  }

  private async searchByName(q: string, query: GroupementQueryDto): Promise<GroupementResponse[]> {
    const normalized = q.trim();
    if (!normalized) return [];

    const conditions = [sql`word_similarity(normalize_search(${normalized}), normalize_search(nom)) > 0.3`];

    this.addFilters(conditions, query);

    const whereClause = sql.join(conditions, sql` AND `);

    const results = await this.dbService.database.execute(sql`
      SELECT *,
        word_similarity(normalize_search(${normalized}), normalize_search(nom)) AS score
      FROM ref_groupements
      WHERE ${whereClause}
      ORDER BY score DESC, population DESC NULLS LAST
      LIMIT ${query.limit ?? 20}
      OFFSET ${query.offset ?? 0}
    `);

    return results.rows.map((row: Record<string, unknown>) => this.mapRawGroupement(row));
  }

  private async findWithFilters(query: GroupementQueryDto): Promise<GroupementResponse[]> {
    const conditions: ReturnType<typeof sql>[] = [];
    this.addFilters(conditions, query);

    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const results = await this.dbService.database.execute(sql`
      SELECT * FROM ref_groupements
      ${whereClause}
      ORDER BY population DESC NULLS LAST
      LIMIT ${query.limit ?? 20}
      OFFSET ${query.offset ?? 0}
    `);

    return results.rows.map((row: Record<string, unknown>) => this.mapRawGroupement(row));
  }

  private addFilters(conditions: ReturnType<typeof sql>[], query: GroupementQueryDto): void {
    if (query.type) {
      const types = query.type.split(",").map((t) => t.trim());
      const typePlaceholders = sql.join(
        types.map((t) => sql`${t}`),
        sql`, `,
      );
      conditions.push(sql`type IN (${typePlaceholders})`);
    }
    if (query.departement) {
      conditions.push(sql`${query.departement} = ANY(departements)`);
    }
    if (query.competence) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ref_groupement_competences gc
        WHERE gc.siren_groupement = ref_groupements.siren
        AND gc.code_competence = ${query.competence}
      )`);
    }
    if (query.commune) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ref_perimetres p
        WHERE p.siren_groupement = ref_groupements.siren
        AND p.code_insee_commune = ${query.commune}
      )`);
    }
  }

  private mapGroupement(g: typeof refGroupements.$inferSelect): GroupementResponse {
    return {
      siren: g.siren,
      nom: g.nom,
      type: g.type,
      population: g.population ?? null,
      nbCommunes: g.nbCommunes ?? null,
      departements: g.departements ?? [],
      regions: g.regions ?? [],
      modeFinancement: g.modeFinancement ?? null,
      dateCreation: g.dateCreation ?? null,
    };
  }

  private mapRawGroupement(row: Record<string, unknown>): GroupementResponse {
    return {
      siren: row.siren as string,
      nom: row.nom as string,
      type: row.type as string,
      population: (row.population as number) ?? null,
      nbCommunes: (row.nb_communes as number) ?? null,
      departements: (row.departements as string[]) ?? [],
      regions: (row.regions as string[]) ?? [],
      modeFinancement: (row.mode_financement as string) ?? null,
      dateCreation: (row.date_creation as string) ?? null,
    };
  }
}
