import { Injectable } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { aideFeedbacks } from "@database/schema";
import { CreateAideFeedbackRequest, AideFeedbackResponse } from "./dto/aide-feedback.dto";

@Injectable()
export class AidesFeedbackService {
  constructor(private readonly dbService: DatabaseService) {}

  async create(dto: CreateAideFeedbackRequest): Promise<AideFeedbackResponse> {
    const [result] = await this.dbService.database
      .insert(aideFeedbacks)
      .values({
        projetId: dto.projetId,
        idAt: dto.idAt,
        feedback: dto.feedback ?? "not_relevant",
        reason: dto.reason ?? null,
        source: dto.source ?? "MEC",
      })
      .onConflictDoUpdate({
        target: [aideFeedbacks.projetId, aideFeedbacks.idAt],
        set: {
          feedback: dto.feedback ?? "not_relevant",
          reason: dto.reason ?? null,
          source: dto.source ?? "MEC",
        },
      })
      .returning();
    return result;
  }

  async findByProjet(projetId: string): Promise<AideFeedbackResponse[]> {
    return this.dbService.database.select().from(aideFeedbacks).where(eq(aideFeedbacks.projetId, projetId));
  }

  async delete(projetId: string, idAt: string): Promise<void> {
    await this.dbService.database
      .delete(aideFeedbacks)
      .where(and(eq(aideFeedbacks.projetId, projetId), eq(aideFeedbacks.idAt, idAt)));
  }
}
