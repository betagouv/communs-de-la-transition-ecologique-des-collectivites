import { Injectable } from "@nestjs/common";
import createClient, { Client } from "openapi-fetch";
import { paths, components } from "@/geo/api";

const GEO_API_URL = "https://geo.api.gouv.fr";

type CommuneFromApi = components["schemas"]["Commune"];
type EpciFromApi = components["schemas"]["Epci"];

export interface Collectivite {
  nom: string;
  type: "Commune" | "EPCI" | "Departement" | "Region";
  codeInsee?: string | null;
  // in case of EPCI, we have multiple departements and regions
  codeDepartements: string[] | null;
  codeRegions: string[] | null;
  codeEpci: string | null;
  siren: string;
}

@Injectable()
export class GeoApiService {
  private client: Client<paths>;

  constructor() {
    this.client = createClient<paths>({ baseUrl: GEO_API_URL });
  }

  public async getAllCommunes(): Promise<Collectivite[]> {
    const { data, error } = await this.client.GET("/communes");

    if (error) {
      throw new Error(`Geo API Error ${error?.message}`);
    }

    return data.map((commune) => this.toCollectiviteCommune(commune));
  }

  public async getAllEpcis(): Promise<Collectivite[]> {
    const { data, error } = await this.client.GET("/epcis");

    console.log("epci", data);
    if (error) {
      throw new Error(`Geo API Error ${error?.message}`);
    }

    return data.map((epci) => this.toCollectiviteEpci(epci));
  }

  private toCollectiviteCommune({
    code,
    codeRegion,
    codeDepartement,
    codeEpci,
    nom,
    siren,
  }: CommuneFromApi): Collectivite {
    return {
      nom: nom!,
      type: "Commune",
      codeInsee: code!,
      codeRegions: [codeRegion!],
      codeDepartements: [codeDepartement!],
      codeEpci: codeEpci ?? null,
      siren: siren!,
    };
  }

  private toCollectiviteEpci({ nom, code, codesDepartements, codesRegions }: EpciFromApi): Collectivite {
    return {
      nom: nom!,
      type: "EPCI",
      codeEpci: code!,
      codeDepartements: codesDepartements ?? null,
      codeRegions: codesRegions ?? null,
      siren: code!,
    };
  }
}
