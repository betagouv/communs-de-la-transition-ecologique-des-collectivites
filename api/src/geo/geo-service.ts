import { BadRequestException, Injectable } from "@nestjs/common";
import { Collectivite, GeoApiService } from "@/geo/geo-api.service";
import { DatabaseService } from "@database/database.service";
import { collectivites } from "@database/schema";
import { CustomLogger } from "@logging/logger.service";
import { formatError } from "@/exceptions/utils";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";
import { sql } from "drizzle-orm";

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

    this.logger.log(`Inserting ${communes.length} communes and ${epcis.length} EPCIs`);

    const BATCH_SIZE = 1000;

    const mapCollectiviteToDbFields = (collectivite: Collectivite) => ({
      nom: collectivite.nom,
      type: collectivite.type,
      codeInsee: collectivite.codeInsee ?? null,
      codeDepartements: collectivite.codeDepartements ?? null,
      codeRegions: collectivite.codeRegions ?? null,
      codeEpci: collectivite.codeEpci ?? null,
      siren: collectivite.siren ?? null,
    });

    // we process communes and epci in 2 stage because the unique constraint from the DB
    // change for communes and epci, needing a different conflict targeting
    for (let i = 0; i < communes.length; i += BATCH_SIZE) {
      const batch = communes.slice(i, i + BATCH_SIZE);

      await this.dbService.database.transaction(async (tx) => {
        try {
          await tx
            .insert(collectivites)
            .values(batch.map(mapCollectiviteToDbFields))
            .onConflictDoUpdate({
              target: [collectivites.codeInsee, collectivites.type],
              set: {
                nom: sql`excluded.nom`,
                codeDepartements: sql`excluded.code_departements`,
                codeRegions: sql`excluded.code_regions`,
                codeEpci: sql`excluded.code_epci`,
                siren: sql`excluded.siren`,
                updatedAt: sql`now()`,
              },
            });
        } catch (e) {
          this.logger.error("failing to create communes batch", formatError(e));
        }
      });

      this.logger.log(`Inserted communes batch ${i / BATCH_SIZE + 1} of ${Math.ceil(communes.length / BATCH_SIZE)}`);
    }

    for (let i = 0; i < epcis.length; i += BATCH_SIZE) {
      const batch = epcis.slice(i, i + BATCH_SIZE);

      await this.dbService.database.transaction(async (tx) => {
        try {
          await tx
            .insert(collectivites)
            .values(batch.map(mapCollectiviteToDbFields))
            .onConflictDoUpdate({
              target: [collectivites.codeEpci, collectivites.type],
              set: {
                nom: sql`excluded.nom`,
                codeInsee: sql`excluded.code_insee`,
                codeDepartements: sql`excluded.code_departements`,
                codeRegions: sql`excluded.code_regions`,
                siren: sql`excluded.siren`,
                updatedAt: sql`now()`,
              },
            });
        } catch (e) {
          this.logger.error("failing to create EPCIs batch", formatError(e));
        }
      });

      this.logger.log(`Inserted EPCIs batch ${i / BATCH_SIZE + 1} of ${Math.ceil(epcis.length / BATCH_SIZE)}`);
    }
  }

  public async validateAndGetCollectivite({ code, type }: CollectiviteReference): Promise<Collectivite> {
    const { data, error } = type === "Commune" ? await this.geoApi.getCommune(code) : await this.geoApi.getEpci(code);

    if (error) {
      throw new BadRequestException(`Cannot find a corresponding Commune for this code ${code}`);
    }
    return data!;
  }
}
