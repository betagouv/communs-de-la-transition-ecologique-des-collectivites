import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { fichesAction, plansTransition, fichesActionToPlansTransition } from "@database/schema";
import { eq, sql, and, ilike } from "drizzle-orm";
import type { FicheActionResponse, FicheActionDetailResponse } from "../dto/fiche-action.dto";

@Injectable()
export class GetFichesService {
  constructor(private readonly dbService: DatabaseService) {}

  async findAll(filters: {
    planId?: string;
    siren?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: FicheActionResponse[]; total: number }> {
    const db = this.dbService.database;
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    // If filtering by planId, we need a join
    if (filters.planId) {
      return this.findByPlan(filters.planId, filters, page, limit, offset);
    }

    const conditions = [];
    if (filters.siren) {
      conditions.push(eq(fichesAction.collectiviteResponsableSiren, filters.siren));
    }
    if (filters.search) {
      conditions.push(ilike(fichesAction.nom, `%${filters.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select().from(fichesAction).where(where).orderBy(fichesAction.nom).limit(limit).offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(fichesAction)
        .where(where),
    ]);

    return {
      data: data.map((row) => this.mapToResponse(row)),
      total: countResult[0].count,
    };
  }

  async findOne(id: string): Promise<FicheActionDetailResponse> {
    const db = this.dbService.database;

    const fiche = await db.select().from(fichesAction).where(eq(fichesAction.id, id)).limit(1);

    if (fiche.length === 0) {
      throw new NotFoundException(`Fiche action ${id} not found`);
    }

    // Fetch linked plans
    const linkedPlans = await db
      .select({
        id: plansTransition.id,
        nom: plansTransition.nom,
        type: plansTransition.type,
      })
      .from(plansTransition)
      .innerJoin(fichesActionToPlansTransition, eq(fichesActionToPlansTransition.planTransitionId, plansTransition.id))
      .where(eq(fichesActionToPlansTransition.ficheActionId, id));

    return {
      ...this.mapToResponse(fiche[0]),
      plansTransition: linkedPlans,
    };
  }

  private async findByPlan(
    planId: string,
    filters: { siren?: string; search?: string },
    _page: number,
    limit: number,
    offset: number,
  ): Promise<{ data: FicheActionResponse[]; total: number }> {
    const db = this.dbService.database;

    const conditions = [eq(fichesActionToPlansTransition.planTransitionId, planId)];
    if (filters.siren) {
      conditions.push(eq(fichesAction.collectiviteResponsableSiren, filters.siren));
    }
    if (filters.search) {
      conditions.push(ilike(fichesAction.nom, `%${filters.search}%`));
    }

    const where = and(...conditions);

    const baseQuery = db
      .select()
      .from(fichesAction)
      .innerJoin(fichesActionToPlansTransition, eq(fichesActionToPlansTransition.ficheActionId, fichesAction.id));

    const [data, countResult] = await Promise.all([
      baseQuery.where(where).orderBy(fichesAction.nom).limit(limit).offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(fichesAction)
        .innerJoin(fichesActionToPlansTransition, eq(fichesActionToPlansTransition.ficheActionId, fichesAction.id))
        .where(where),
    ]);

    return {
      data: data.map((row) => this.mapToResponse(row.fiches_action)),
      total: countResult[0].count,
    };
  }

  private mapToResponse(row: typeof fichesAction.$inferSelect): FicheActionResponse {
    return {
      id: row.id,
      nom: row.nom,
      description: row.description,
      statut: row.statut,
      collectiviteResponsableSiren: row.collectiviteResponsableSiren,
      territoireCommunes: row.territoireCommunes,
      classificationThematiques: row.classificationThematiques,
      tcSecteurs: row.tcSecteurs,
      tcTypesPorteur: row.tcTypesPorteur,
      tcTypeAction: row.tcTypeAction,
      tcCibleAction: row.tcCibleAction,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
