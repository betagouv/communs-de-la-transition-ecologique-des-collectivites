import { BadRequestException, Injectable } from "@nestjs/common";
import { Collectivite, GeoApiService } from "@/geo/geo-api.service";
import { DatabaseService } from "@database/database.service";
import { collectivites } from "@database/schema";
import { CustomLogger } from "@logging/logger.service";
import { formatError } from "@/exceptions/utils";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";
import { sql, eq } from "drizzle-orm";

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

    const upatedValues = {
      nom: sql`excluded.nom`,
      type: sql`excluded.type`,
      codeInsee: sql`excluded.code_insee`,
      codeDepartements: sql`excluded.code_departements`,
      codeRegions: sql`excluded.code_regions`,
      codeEpci: sql`excluded.code_epci`,
      updatedAt: sql`now()`,
    };

    // Helper function to process individual records when batch fails
    const processIndividualRecords = async (records: Collectivite[], type: "communes" | "epcis") => {
      for (const record of records) {
        try {
          const mappedValue = mapCollectiviteToDbFields(record);

          await this.dbService.database.transaction(async (tx) => {
            if (type === "communes") {
              // For communes, always use (codeInsee, type) constraint
              await tx
                .insert(collectivites)
                .values([mappedValue])
                .onConflictDoUpdate({
                  target: [collectivites.codeInsee, collectivites.type],
                  targetWhere: eq(collectivites.type, "Commune"),
                  set: upatedValues,
                });
            } else {
              // For EPCIs, always use (codeEpci, type) constraint
              await tx
                .insert(collectivites)
                .values([mappedValue])
                .onConflictDoUpdate({
                  target: [collectivites.codeEpci, collectivites.type],
                  targetWhere: eq(collectivites.type, "EPCI"),
                  set: upatedValues,
                });
            }
          });
        } catch (e) {
          // Log the specific failing record
          this.logger.error(`INDIVIDUAL RECORD FAILED - ${type.slice(0, -1)}:`, {
            nom: record.nom,
            codeInsee: record.codeInsee,
            codeEpci: record.codeEpci,
            siren: record.siren,
            type: record.type,
            error: formatError(e),
          });
        }
      }
    };

    // we process communes and epci in 2 stage because the unique constraint from the DB
    // change for communes and epci, needing a different conflict target
    for (let i = 0; i < communes.length; i += BATCH_SIZE) {
      const batch = communes.slice(i, i + BATCH_SIZE);

      try {
        await this.dbService.database.transaction(async (tx) => {
          const mappedValues = batch.map(mapCollectiviteToDbFields);

          // For communes, always use (codeInsee, type) constraint
          await tx
            .insert(collectivites)
            .values(mappedValues)
            .onConflictDoUpdate({
              target: [collectivites.codeInsee, collectivites.type],
              targetWhere: eq(collectivites.type, "Commune"),
              set: upatedValues,
            });
        });
        this.logger.log(`Inserted communes batch ${i / BATCH_SIZE} of ${Math.ceil(communes.length / BATCH_SIZE)}`);
      } catch (e) {
        this.logger.error(`Batch ${i / BATCH_SIZE} failed, processing individual records...`, formatError(e));
        // Process individual records to identify the failing ones if any
        await processIndividualRecords(batch, "communes");
        this.logger.log(`Processed individual records for communes batch ${i / BATCH_SIZE}`);
      }
    }

    for (let i = 0; i < epcis.length; i += BATCH_SIZE) {
      const batch = epcis.slice(i, i + BATCH_SIZE);

      try {
        await this.dbService.database.transaction(async (tx) => {
          const mappedValues = batch.map(mapCollectiviteToDbFields);

          await tx
            .insert(collectivites)
            .values(mappedValues)
            .onConflictDoUpdate({
              target: [collectivites.codeEpci, collectivites.type],
              targetWhere: eq(collectivites.type, "EPCI"),
              set: upatedValues,
            });
        });
        this.logger.log(`Inserted EPCIs batch ${i / BATCH_SIZE} of ${Math.ceil(epcis.length / BATCH_SIZE)}`);
      } catch (e) {
        this.logger.error(`Batch ${i / BATCH_SIZE} failed, processing individual records...`, formatError(e));
        // Process individual records to identify the failing ones
        await processIndividualRecords(batch, "epcis");
        this.logger.log(`Processed individual records for EPCIs batch ${i / BATCH_SIZE}`);
      }
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
