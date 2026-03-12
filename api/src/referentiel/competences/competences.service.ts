import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { refCompetences, refCompetenceCategories } from "@database/schema";
import { CompetenceResponse } from "./dto/competence.response";

@Injectable()
export class CompetencesService {
  constructor(private readonly dbService: DatabaseService) {}

  async findAllCategories(): Promise<{ code: string; nom: string }[]> {
    return this.dbService.database
      .select({ code: refCompetenceCategories.code, nom: refCompetenceCategories.nom })
      .from(refCompetenceCategories)
      .orderBy(refCompetenceCategories.code);
  }

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
}
