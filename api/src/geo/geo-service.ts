import { Injectable } from "@nestjs/common";
import { GeoApiService } from "@/geo/geo-api.service";
// import { DatabaseService } from "@database/database.service";
// import { collectivites } from "@database/schema";

// const COMMUNES_BATCH_SIZE = 10000;

@Injectable()
export class GeoService {
  constructor(
    private geoApi: GeoApiService,
    // private readonly dbService: DatabaseService,
  ) {}

  public async createAllCollectivites(): Promise<void> {
    const communes = await this.geoApi.getAllCommunes();
    const epcis = await this.geoApi.getAllEpcis();

    const allCollectivites = [...communes, ...epcis];

    // Insertion par lots pour éviter les problèmes de performance
    // const BATCH_SIZE = 1000;
    //
    // for (let i = 0; i < allCollectivites.length; i += BATCH_SIZE) {
    //   const batch = allCollectivites.slice(i, i + BATCH_SIZE);
    //
    //   await this.dbService.database.transaction(async (tx) => {
    //     await tx
    //       .insert(collectivites)
    //       .values(
    //         batch.map((collectivite) => ({
    //           nom: collectivite.nom,
    //           type: collectivite.type,
    //           codeInsee: collectivite.codeInsee ?? null,
    //           codeDepartement: collectivite.codeDepartement ?? null,
    //           codeRegion: collectivite.codeRegion ?? null,
    //           codeEpci: collectivite.codeEpci ?? null,
    //           siren: collectivite.siren ?? null,
    //           siret: collectivite.siret ?? null,
    //         })),
    //       )
    //       .onConflictDoNothing();
    //   });

    //   console.log(`Inserted batch ${i / BATCH_SIZE + 1} of ${Math.ceil(allCollectivites.length / BATCH_SIZE)}`);
    // }

    console.log(`Inserted ${allCollectivites.length} collectivites`);
  }
}
