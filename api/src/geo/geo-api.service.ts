import { Injectable } from "@nestjs/common";
import createClient, { Client } from "openapi-fetch";
import { components, paths } from "@/geo/api";

const GEO_API_URL = "https://geo.api.gouv.fr";

type CommuneFromApi = components["schemas"]["Commune"];
type EpciFromApi = components["schemas"]["Epci"];

export interface Collectivite {
  nom: string;
  type: "Commune" | "EPCI";
  codeInsee?: string | null;
  // in case of EPCI, we have multiple departements and regions
  codeDepartements: string[] | null;
  codeRegions: string[] | null;
  codeEpci: string | null;
  siren: string;
}
export interface GeoApiError {
  name?: string;
  message?: string;
  description?: string;
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

    if (error) {
      throw new Error(`Geo API Error ${error?.message}`);
    }

    return data.map((epci) => this.toCollectiviteEpci(epci));
  }

  public async getCommune(code: string): Promise<{ error?: GeoApiError; data?: Collectivite }> {
    const { data, error } = await this.client.GET(`/communes/{code}`, { params: { path: { code } } });

    if (error) {
      return { error, data: undefined };
    }

    return { error: undefined, data: this.toCollectiviteCommune(data) };
  }

  public async getEpci(code: string): Promise<{ error?: GeoApiError; data?: Collectivite }> {
    const { data, error } = await this.client.GET(`/epcis/{code}`, { params: { path: { code } } });

    if (error) {
      return { error, data };
    }

    return { error: undefined, data: this.toCollectiviteEpci(data) };
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
