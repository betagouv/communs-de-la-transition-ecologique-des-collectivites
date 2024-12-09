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

    // Create any new communes that don't exist yet
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

    // for now we remove all communes linked to the project in th projectToCommunes table
    // and recreate them based on the new array - might need more granular approach
    await tx
      .delete(projectsToCommunes)
      .where(eq(projectsToCommunes.projectId, projectId));

    await tx.insert(projectsToCommunes).values(
      inseeCodes.map((inseeCode) => ({
        projectId,
        communeId: inseeCode,
      })),
    );
  }
}
