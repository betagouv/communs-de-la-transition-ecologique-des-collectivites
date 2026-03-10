import { Injectable, NotFoundException } from "@nestjs/common";
import { sql, eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { refCompetences, refCompetenceCategories } from "@database/schema";
import { CompetenceResponse } from "./dto/competence.response";
import { CompetenceGroupementsQueryDto } from "./dto/competence-query.dto";
import { GroupementResponse } from "../groupements/dto/groupement.response";

@Injectable()
export class CompetencesService {
  constructor(private readonly dbService: DatabaseService) {}

  async findAll(categorie?: string): Promise<CompetenceResponse[]> {
    const conditions = categorie ? eq(refCompetences.codeCategorie, categorie) : undefined;

    const results = await this.dbService.database
      .select({
        code: refCompetences.code,
        nom: refCompetences.nom,
        categorieCode: refCompetenceCategories.code,
        categorieNom: refCompetenceCategories.nom,
      })
      .from(refCompetences)
      .innerJoin(refCompetenceCategories, eq(refCompetences.codeCategorie, refCompetenceCategories.code))
      .where(conditions)
      .orderBy(refCompetenceCategories.code, refCompetences.code);

    return results.map((r) => ({
      code: r.code,
      nom: r.nom,
      categorie: { code: r.categorieCode, nom: r.categorieNom },
    }));
  }

  async findOne(code: string): Promise<CompetenceResponse> {
    const results = await this.dbService.database
      .select({
        code: refCompetences.code,
        nom: refCompetences.nom,
        categorieCode: refCompetenceCategories.code,
        categorieNom: refCompetenceCategories.nom,
      })
      .from(refCompetences)
      .innerJoin(refCompetenceCategories, eq(refCompetences.codeCategorie, refCompetenceCategories.code))
      .where(eq(refCompetences.code, code));

    if (results.length === 0) {
      throw new NotFoundException(`Compétence ${code} non trouvée`);
    }

    const r = results[0];
    return {
      code: r.code,
      nom: r.nom,
      categorie: { code: r.categorieCode, nom: r.categorieNom },
    };
  }

  async getGroupements(code: string, query: CompetenceGroupementsQueryDto): Promise<GroupementResponse[]> {
    // Verify competence exists
    await this.findOne(code);

    const conditions = [sql`gc.code_competence = ${code}`];

    if (query.commune) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ref_perimetres p
        WHERE p.siren_groupement = g.siren
        AND p.code_insee_commune = ${query.commune}
      )`);
    }
    if (query.departement) {
      conditions.push(sql`${query.departement} = ANY(g.departements)`);
    }
    if (query.type) {
      const types = query.type.split(",").map((t) => t.trim());
      const typePlaceholders = sql.join(
        types.map((t) => sql`${t}`),
        sql`, `,
      );
      conditions.push(sql`g.type IN (${typePlaceholders})`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    const results = await this.dbService.database.execute(sql`
      SELECT g.*
      FROM ref_groupements g
      JOIN ref_groupement_competences gc ON gc.siren_groupement = g.siren
      WHERE ${whereClause}
      ORDER BY g.population DESC NULLS LAST
      LIMIT ${query.limit ?? 20}
      OFFSET ${query.offset ?? 0}
    `);

    return results.rows.map((row: Record<string, unknown>) => ({
      siren: row.siren as string,
      nom: row.nom as string,
      type: row.type as string,
      population: (row.population as number) ?? null,
      nbCommunes: (row.nb_communes as number) ?? null,
      departements: (row.departements as string[]) ?? [],
      regions: (row.regions as string[]) ?? [],
      modeFinancement: (row.mode_financement as string) ?? null,
      dateCreation: (row.date_creation as string) ?? null,
    }));
  }
}
