import { Injectable } from "@nestjs/common";
import { Commune, Epci, GeoApiService } from "@/geo/geo-api.service";

// const COMMUNES_BATCH_SIZE = 10000;

@Injectable()
export class GeoService {
  constructor(
    private geoApi: GeoApiService,
    // private readonly dbService: DatabaseService,
  ) {}

  public async createAllCommunes(): Promise<Commune[]> {
    const communes = await this.geoApi.getAllCommunes();

    console.log("Communes", communes);
    return communes;
  }

  public async createAllEpcis(): Promise<Epci[]> {
    const epcis = await this.geoApi.getAllEpcis();
    console.log("EPCIs", epcis);
    return epcis;
  }
}
