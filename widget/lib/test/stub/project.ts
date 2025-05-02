import { ExtraFields, ProjectData } from "../../components/ServicesWidget/types.ts";

export const project: ProjectData = {
  description: "description",
  phase: "Opération",
  collectivites: [
    {
      codeEpci: "200069193",
      siren: "210100012",
      codeInsee: "01001",
      type: "Commune",
      id: "collectivite-01",
      codeDepartements: null,
      codeRegions: null,
      nom: "L'Abergement-Clémenciat",
    },
  ],
};

export const extraFields: ExtraFields = [{ name: "surface", value: "1000" }];
