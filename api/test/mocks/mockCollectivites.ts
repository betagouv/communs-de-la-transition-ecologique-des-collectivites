import { InferSelectModel } from "drizzle-orm";
import { collectivites } from "@database/schema";

type Collectivite = InferSelectModel<typeof collectivites>;

export const mockCollectivites: Collectivite[] = [
  {
    id: "collectivite-1",
    nom: "Versailles",
    type: "Commune",
    codeInsee: "78646",
    codeDepartements: ["78"],
    codeRegions: ["11"], // Île-de-France
    codeEpci: "247800584",
    siren: "217806462",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
