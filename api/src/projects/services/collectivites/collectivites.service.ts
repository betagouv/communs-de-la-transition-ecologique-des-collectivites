import { Injectable } from "@nestjs/common";
import { Tx } from "@database/database.service";
import { collectivites, projectsToCollectivites } from "@database/schema";
import { eq, inArray, and, not } from "drizzle-orm";
import { CollectiviteReference } from "@projects/dto/collectivite.dto";

@Injectable()
export class CollectivitesService {
  async createOrUpdateRelations(tx: Tx, projectId: string, collectiviteRefs: CollectiviteReference[]): Promise<void> {
    if (collectiviteRefs.length === 0) {
      throw new Error("At least one collecitvite needs to be assiocated to the project");
    }

    const collectiviteIds = await this.getCollectivitesIdsByRefs(tx, collectiviteRefs);

    // check that allCollectivities are in base otherwise we are missing some collectivities
    // and we need to create them

    //delete old relations
    await tx
      .delete(projectsToCollectivites)
      .where(
        and(
          eq(projectsToCollectivites.projectId, projectId),
          not(inArray(projectsToCollectivites.collectiviteId, collectiviteIds)),
        ),
      );

    // Create new relations
    await tx
      .insert(projectsToCollectivites)
      .values(
        collectiviteIds.map((collectiviteId) => ({
          projectId,
          collectiviteId,
        })),
      )
      .onConflictDoNothing();
  }

  async getCollectivitesIdsByRefs(tx: Tx, collectiviteRefs: CollectiviteReference[]): Promise<string[]> {
    const collectiviteIds: string[] = [];

    for (const ref of collectiviteRefs) {
      const id = await this.getCollectiviteIdByRef(tx, ref.type, ref.code);

      if (id) {
        collectiviteIds.push(id);
      }
    }

    return collectiviteIds;
  }

  async getCollectiviteIdByRef(tx: Tx, type: CollectiviteReference["type"], code: string): Promise<string | null> {
    let field: keyof typeof collectivites.$inferInsert;

    switch (type) {
      case "Commune":
        field = "codeInsee";
        break;
      case "EPCI":
        field = "codeEpci";
        break;
      default:
        throw new Error(`CollectivityType not supported: ${type as string}`);
    }

    const result = await tx
      .select({ id: collectivites.id })
      .from(collectivites)
      .where(and(eq(collectivites.type, type), eq(collectivites[field], code)));

    return result.length > 0 ? result[0].id : null;
  }
}
