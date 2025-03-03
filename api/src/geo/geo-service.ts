import { Injectable } from "@nestjs/common";
import { GeoApiService } from "@/geo/geo-api.service";
import { DatabaseService } from "@database/database.service";
import { collectivites } from "@database/schema";
import { CustomLogger } from "@logging/logger.service";
import { formatError } from "@/exceptions/utils";

@Injectable()
export class GeoService {
  constructor(
    private geoApi: GeoApiService,
    private readonly dbService: DatabaseService,
    private logger: CustomLogger,
  ) {}

  public async createAllCollectivites(): Promise<void> {
    const communes = await this.geoApi.getAllCommunes();
    const epcis = await this.geoApi.getAllEpcis();

    const allCollectivites = [...communes, ...epcis];

    this.logger.log(`Inserting ${allCollectivites.length} collectivites`);

    const BATCH_SIZE = 1000;

    for (let i = 0; i < allCollectivites.length; i += BATCH_SIZE) {
      const batch = allCollectivites.slice(i, i + BATCH_SIZE);

      await this.dbService.database.transaction(async (tx) => {
        try {
          await tx.insert(collectivites).values(
            batch.map((collectivite) => ({
              nom: collectivite.nom,
              type: collectivite.type,
              codeInsee: collectivite.codeInsee ?? null,
              codeDepartement: collectivite.codeDepartements ?? null,
              codeRegion: collectivite.codeRegions ?? null,
              codeEpci: collectivite.codeEpci ?? null,
              siren: collectivite.siren ?? null,
            })),
          );
        } catch (e) {
          this.logger.error("failing to create all collectivites", formatError(e));
        }
      });

      this.logger.log(`Inserted batch ${i / BATCH_SIZE + 1} of ${Math.ceil(allCollectivites.length / BATCH_SIZE)}`);
    }
  }
}
