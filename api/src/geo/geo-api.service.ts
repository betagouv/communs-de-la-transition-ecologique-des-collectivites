import { Injectable } from "@nestjs/common";
import createClient, { Client } from "openapi-fetch";
import { paths, components } from "@/geo/api";

const GEO_API_URL = "https://geo.api.gouv.fr";

//  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
//   nom: text("nom").notNull(),
//   type: collectiviteTypeEnum("type").notNull(),
//
//   // Codes officiels
//   codeInsee: text("code_insee").unique(),
//   codeDepartement: text("code_departement"),
//   codeRegion: text("code_region"),
//   codeEpci: text("code_epci").unique(),
//   siren: text("siren").unique(),
//   siret: text("siret").unique(),
//
//   createdAt: timestamp("created_at").notNull().defaultNow(),
//   updatedAt: timestamp("updated_at").notNull().defaultNow(),
// }, (table) => ({
//   inseeIdx: index("collectivite_insee_idx").on(table.codeInsee),
//   deptIdx: index("collectivite_dept_idx").on(table.codeDepartement),
//   regionIdx: index("collectivite_region_idx").on(table.codeRegion),
//   epciIdx: index("collectivite_epci_idx").on(table.codeEpci),
//   sirenIdx: index("collectivite_siren_idx").on(table.siren),
// }));

type CommuneFromApi = components["schemas"]["Commune"];
type EpciFromApi = components["schemas"]["Epci"];

export interface Commune {
  nom: string;
  codeInsee: string;
  codeDepartement: string;
  codeRegion: string;
  codeEpci: string | null;
  siren: string;
  collectiviteType: "Commune";
}

export interface Epci {
  nom: string;
  codeEpci: string;
  codeDepartements: string[];
  codeRegions: string[];
  collectiviteType: "EPCI";
}

@Injectable()
export class GeoApiService {
  private client: Client<paths>;

  constructor() {
    this.client = createClient<paths>({ baseUrl: GEO_API_URL });
  }

  public async getAllCommunes(): Promise<Commune[]> {
    const { data, error } = await this.client.GET("/communes", { params: { query: {} } });

    if (error) {
      throw new Error(`Geo API Error ${error as any}`);
    }

    return data.map((commune) => this.toCommune(commune));
  }

  public async getAllEpcis(): Promise<Epci[]> {
    const { data, error } = await this.client.GET("/epcis", { params: { query: {} } });

    if (error) {
      throw new Error(`Geo API Error ${error as any}`);
    }

    return data.map((epci) => this.toEpci(epci));
  }

  private toCommune({ code, codeRegion, codeDepartement, codeEpci, nom, siren }: CommuneFromApi): Commune {
    return {
      siren: siren!,
      codeInsee: code!,
      nom: nom!,
      codeRegion: codeRegion!,
      codeDepartement: codeDepartement!,
      codeEpci: codeEpci ?? null,
      collectiviteType: "Commune",
    };
  }

  private toEpci({ nom, code, codesDepartements, codesRegions }: EpciFromApi): Epci {
    return {
      nom: nom!,
      codeEpci: code!,
      codeDepartements: codesDepartements!,
      codeRegions: codesRegions!,
      collectiviteType: "EPCI",
    };
  }
}
