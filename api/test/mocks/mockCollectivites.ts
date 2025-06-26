import { InferSelectModel } from "drizzle-orm";
import { collectivites } from "@database/schema";
import { RegionCode } from "@/shared/const/region-codes";

type Collectivite = InferSelectModel<typeof collectivites>;

export const VAL_DE_LOIRE_REGION_CODE: RegionCode = "24";
export const ILE_DE_FRANCE_REGION_CODE: RegionCode = "11";

export const mockCollectivites: Collectivite[] = [
  {
    id: "collectivite-1",
    nom: "Versailles",
    type: "Commune",
    codeInsee: "78646",
    codeDepartements: ["78"],
    codeRegions: [ILE_DE_FRANCE_REGION_CODE], // Île-de-France
    codeEpci: "247800584",
    siren: "217806462",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
