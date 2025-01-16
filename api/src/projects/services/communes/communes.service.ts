import { Injectable } from "@nestjs/common";
import { Tx } from "@database/database.service";
import { communes, projectsToCommunes } from "@database/schema";
import { eq, inArray, not, and } from "drizzle-orm";

@Injectable()
export class CommunesService {
  async createOrUpdate(tx: Tx, projectId: string, inseeCodes: string[]): Promise<void> {
    await tx
      .insert(communes)
      .values(
        inseeCodes.map((inseeCode) => ({
          inseeCode,
        })),
      )
      .onConflictDoNothing();

    await tx
      .delete(projectsToCommunes)
      .where(and(eq(projectsToCommunes.projectId, projectId), not(inArray(projectsToCommunes.communeId, inseeCodes))));

    await tx
      .insert(projectsToCommunes)
      .values(
        inseeCodes.map((inseeCode) => ({
          projectId,
          communeId: inseeCode,
        })),
      )
      .onConflictDoNothing();
  }
}
