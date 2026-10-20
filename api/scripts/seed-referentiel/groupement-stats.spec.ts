import { mergePerimetres, resolveSyndicatPerimetres, withMemberStats } from "./groupement-stats";
import type { RawCommune, RawGroupement, RawPerimetre } from "./sources/types";

const commune = (codeInsee: string, siren: string, population: number | null): RawCommune => ({
  codeInsee,
  siren,
  siret: null,
  nom: codeInsee,
  population,
  codesPostaux: [],
  codeDepartement: "01",
  codeRegion: "84",
  codeEpci: null,
});

const groupement = (siren: string, overrides: Partial<RawGroupement> = {}): RawGroupement => ({
  siren,
  siret: null,
  nom: siren,
  type: "CC",
  population: 999999, // as parsed from Banatic: not trusted
  nbCommunes: null,
  departements: [],
  regions: [],
  modeFinancement: null,
  dateCreation: null,
  ...overrides,
});

const perimetre = (sirenGroupement: string, codeInseeCommune: string): RawPerimetre => ({
  sirenGroupement,
  codeInseeCommune,
  categorieMembre: null,
});

describe("resolveSyndicatPerimetres", () => {
  const sirenToInsee = new Map([
    ["210100012", "01001"],
    ["210100020", "01002"],
    ["210100038", "01003"],
  ]);
  const epciPerimetres = new Map([["200069193", new Set(["01001", "01002"])]]);

  it("maps a commune member to its INSEE code", () => {
    const result = resolveSyndicatPerimetres(
      [{ sirenGroupement: "250100001", sirenMembre: "210100038", categorieMembre: "commune" }],
      sirenToInsee,
      epciPerimetres,
    );
    expect(result).toEqual([{ sirenGroupement: "250100001", codeInseeCommune: "01003", categorieMembre: "commune" }]);
  });

  it("expands an EPCI member to the communes of the EPCI", () => {
    const result = resolveSyndicatPerimetres(
      [{ sirenGroupement: "250100001", sirenMembre: "200069193", categorieMembre: "groupement" }],
      sirenToInsee,
      epciPerimetres,
    );
    expect(result.map((p) => p.codeInseeCommune).sort()).toEqual(["01001", "01002"]);
    expect(result.every((p) => p.sirenGroupement === "250100001")).toBe(true);
  });

  it("deduplicates a commune reached both directly and through its EPCI, and skips unknown members", () => {
    const result = resolveSyndicatPerimetres(
      [
        { sirenGroupement: "250100001", sirenMembre: "210100012", categorieMembre: "commune" },
        { sirenGroupement: "250100001", sirenMembre: "200069193", categorieMembre: "groupement" },
        { sirenGroupement: "250100001", sirenMembre: "999999999", categorieMembre: "autre" },
      ],
      sirenToInsee,
      epciPerimetres,
    );
    expect(result.map((p) => p.codeInseeCommune).sort()).toEqual(["01001", "01002"]);
  });
});

describe("withMemberStats", () => {
  const communes = [
    commune("01001", "210100012", 800),
    commune("01002", "210100020", 250),
    commune("01003", "x", null),
  ];

  it("computes population and number of communes from the member communes", () => {
    const [cc] = withMemberStats(
      [groupement("200069193")],
      [perimetre("200069193", "01001"), perimetre("200069193", "01002")],
      communes,
    );
    expect(cc).toMatchObject({ population: 1050, nbCommunes: 2 });
  });

  it("counts a commune without population without adding to the total", () => {
    const [g] = withMemberStats([groupement("g")], [perimetre("g", "01001"), perimetre("g", "01003")], communes);
    expect(g).toMatchObject({ population: 800, nbCommunes: 2 });
  });

  it("leaves both null for a groupement without known member commune", () => {
    const [g] = withMemberStats([groupement("g")], [], communes);
    expect(g).toMatchObject({ population: null, nbCommunes: null });
  });
});

describe("mergePerimetres", () => {
  it("adds the syndicat perimetres not already known from the EPCI", () => {
    const merged = mergePerimetres(
      [perimetre("200069193", "01001")],
      [perimetre("200069193", "01001"), perimetre("250100001", "01001")],
    );
    expect(merged.map((p) => `${p.sirenGroupement}:${p.codeInseeCommune}`)).toEqual([
      "200069193:01001",
      "250100001:01001",
    ]);
  });

  it("handles production volumes (~400 000 perimetres) without overflowing the call stack", () => {
    const syndicats = Array.from({ length: 400_000 }, (_, i) => perimetre(`s${i % 5000}`, String(i)));
    expect(mergePerimetres([], syndicats)).toHaveLength(400_000);
  });
});
