import { splitLeviersCsv } from "./leviers-csv";
import { leviers } from "@/shared/const/leviers";

describe("splitLeviersCsv", () => {
  it("renvoie [] pour une valeur vide ou nulle", () => {
    expect(splitLeviersCsv(null)).toEqual([]);
    expect(splitLeviersCsv(undefined)).toEqual([]);
    expect(splitLeviersCsv("")).toEqual([]);
  });

  it("découpe des leviers canoniques simples", () => {
    expect(splitLeviersCsv("Vélo,Covoiturage")).toEqual(["Vélo", "Covoiturage"]);
  });

  it("préserve un levier canonique contenant une virgule", () => {
    const withComma =
      "Prévention des inondations par débordement de cours d'eau, notamment via restauration des milieux aquatiques";
    expect(leviers).toContain(withComma);
    expect(splitLeviersCsv(withComma)).toEqual([withComma]);
  });

  it("découpe correctement un levier à virgule suivi d'un autre levier", () => {
    const withComma =
      "Prévention des inondations par débordement de cours d'eau, notamment via restauration des milieux aquatiques";
    expect(splitLeviersCsv(`${withComma},Vélo`)).toEqual([withComma, "Vélo"]);
    expect(splitLeviersCsv(`Vélo,${withComma}`)).toEqual(["Vélo", withComma]);
  });

  it("retombe sur un split par virgule pour des fragments inconnus", () => {
    expect(splitLeviersCsv("Inconnu A,Inconnu B")).toEqual(["Inconnu A", "Inconnu B"]);
  });

  it("mélange leviers canoniques et fragments inconnus", () => {
    expect(splitLeviersCsv("Vélo,Fragment libre")).toEqual(["Vélo", "Fragment libre"]);
  });
});
