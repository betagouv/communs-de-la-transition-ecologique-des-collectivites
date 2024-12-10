import { Injectable } from "@nestjs/common";
import { Tx } from "@database/database.service";
import { communes, projectsToCommunes } from "@database/schema";
import { eq, inArray } from "drizzle-orm";

@Injectable()
export class CommunesService {
  async createOrUpdate(
    tx: Tx,
    projectId: string,
    inseeCodes: string[],
  ): Promise<void> {
    // Create any new communes that don't exist yet

    const existingCommunes = await tx
      .select()
      .from(communes)
      .where(inArray(communes.inseeCode, inseeCodes));

    const existingInseeCodes = new Set(
      existingCommunes.map((c) => c.inseeCode),
    );

    const communesToCreate = inseeCodes.filter(
      (code) => !existingInseeCodes.has(code),
    );

    if (communesToCreate.length > 0) {
      await tx
        .insert(communes)
        .values(
          communesToCreate.map((inseeCode) => ({
            inseeCode,
          })),
        )
        .onConflictDoNothing();
    }

    // Add or remove communes from the project relations

    const existingRelations = await tx
      .select()
      .from(projectsToCommunes)
      .where(eq(projectsToCommunes.projectId, projectId));

    const existingCommuneIds = new Set(
      existingRelations.map((r) => r.communeId),
    );
    const newCommuneIds = new Set(inseeCodes);

    const communesToAddToProject = inseeCodes.filter(
      (code) => !existingCommuneIds.has(code),
    );
    const communesToRemoveFromProject = Array.from(existingCommuneIds).filter(
      (code) => !newCommuneIds.has(code),
    );

    if (communesToRemoveFromProject.length > 0) {
      await tx
        .delete(projectsToCommunes)
        .where(
          eq(projectsToCommunes.projectId, projectId) &&
            inArray(projectsToCommunes.communeId, communesToRemoveFromProject),
        );
    }

    if (communesToAddToProject.length > 0) {
      await tx.insert(projectsToCommunes).values(
        communesToAddToProject.map((inseeCode) => ({
          projectId,
          communeId: inseeCode,
        })),
      );
    }
  }
}
