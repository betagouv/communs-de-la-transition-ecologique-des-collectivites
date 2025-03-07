import { Injectable } from "@nestjs/common";
import { Tx } from "@database/database.service";
import { collectivites, projetsToCollectivites } from "@database/schema";
import { and, eq } from "drizzle-orm";
import { CustomLogger } from "@logging/logger.service";
import { GeoService } from "@/geo/geo-service";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";

@Injectable()
export class CollectivitesService {
  constructor(
    private logger: CustomLogger,
    private readonly geoService: GeoService,
  ) {}

  public async createOrUpdateRelations(
    tx: Tx,
    projetId: string,
    collectiviteRefs: CollectiviteReference[],
  ): Promise<void> {
    if (collectiviteRefs.length === 0) {
      throw new Error("At least one collectivite needs to be associated to the project");
    }

    const { collectiviteIds, missingRefs } = await this.getCollectivitesIdsAndMissingRefs(tx, collectiviteRefs);

    const allCollectiviteIds = [...collectiviteIds];

    if (missingRefs.length > 0) {
      this.logger.log("collectivite missing in database", { missingRefs });

      for (const missingRef of missingRefs) {
        const validCollectivite = await this.geoService.validateAndGetCollectivite(missingRef);
        const insertResults = await tx
          .insert(collectivites)
          .values(validCollectivite)
          .onConflictDoNothing()
          .returning();

        allCollectiviteIds.push(...insertResults.map((result) => result.id));
      }
    }

    // Delete old relations
    await tx.delete(projetsToCollectivites).where(eq(projetsToCollectivites.projetId, projetId));

    // Create new relations
    await tx
      .insert(projetsToCollectivites)
      .values(
        allCollectiviteIds.map((collectiviteId) => ({
          projetId,
          collectiviteId,
        })),
      )
      .onConflictDoNothing();
  }

  async getCollectivitesIdsAndMissingRefs(
    tx: Tx,
    collectiviteRefs: CollectiviteReference[],
  ): Promise<{ collectiviteIds: string[]; missingRefs: CollectiviteReference[] }> {
    const collectiviteIds: string[] = [];
    const missingRefs: CollectiviteReference[] = [];

    for (const ref of collectiviteRefs) {
      const id = await this.getCollectiviteIdByRef(tx, ref.type, ref.code);

      if (id) {
        collectiviteIds.push(id);
      } else {
        missingRefs.push(ref);
      }
    }

    return { collectiviteIds, missingRefs };
  }

  private async getCollectiviteIdByRef(
    tx: Tx,
    type: CollectiviteReference["type"],
    code: string,
  ): Promise<string | null> {
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
