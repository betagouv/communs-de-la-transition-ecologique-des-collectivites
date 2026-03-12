import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { plansTransition, fichesAction, fichesActionToPlansTransition } from "@database/schema";
import { eq, sql, and, ilike } from "drizzle-orm";
import type { PlanTransitionResponse, PlanTransitionDetailResponse } from "../dto/plan-transition.dto";

@Injectable()
export class GetPlansService {
  constructor(private readonly dbService: DatabaseService) {}

  async findAll(filters: {
    siren?: string;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: PlanTransitionResponse[]; total: number }> {
    const db = this.dbService.database;
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (filters.siren) {
      conditions.push(eq(plansTransition.collectiviteResponsableSiren, filters.siren));
    }
    if (filters.type) {
      const escaped = filters.type.replace(/[%_\\]/g, "\\$&");
      conditions.push(ilike(plansTransition.type, escaped));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select().from(plansTransition).where(where).orderBy(plansTransition.nom).limit(limit).offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(plansTransition)
        .where(where),
    ]);

    return {
      data: data.map((row) => this.mapToResponse(row)),
      total: countResult[0].count,
    };
  }

  async findOne(id: string): Promise<PlanTransitionDetailResponse> {
    const db = this.dbService.database;

    const plan = await db.select().from(plansTransition).where(eq(plansTransition.id, id)).limit(1);

    if (plan.length === 0) {
      throw new NotFoundException(`Plan de transition ${id} not found`);
    }

    // Fetch linked fiches action
    const linkedFiches = await db
      .select({
        id: fichesAction.id,
        nom: fichesAction.nom,
        description: fichesAction.description,
      })
      .from(fichesAction)
      .innerJoin(fichesActionToPlansTransition, eq(fichesActionToPlansTransition.ficheActionId, fichesAction.id))
      .where(eq(fichesActionToPlansTransition.planTransitionId, id))
      .orderBy(fichesAction.nom);

    return {
      ...this.mapToResponse(plan[0]),
      fichesAction: linkedFiches,
    };
  }

  private mapToResponse(row: typeof plansTransition.$inferSelect): PlanTransitionResponse {
    return {
      id: row.id,
      nom: row.nom,
      type: row.type,
      description: row.description,
      periodeDebut: row.periodeDebut,
      periodeFin: row.periodeFin,
      collectiviteResponsableSiren: row.collectiviteResponsableSiren,
      territoireCommunes: row.territoireCommunes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
