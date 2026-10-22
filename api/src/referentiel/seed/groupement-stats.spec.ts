import { epciFromBanatic, mergePerimetres, resolveMemberPerimetres, withMemberStats } from "./groupement-stats";
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

describe("resolveMemberPerimetres", () => {
  const sirenToInsee = new Map([
    ["210100012", "01001"],
    ["210100020", "01002"],
    ["210100038", "01003"],
  ]);
  const epciPerimetres = new Map([["200069193", new Set(["01001", "01002"])]]);

  it("maps a commune member to its INSEE code", () => {
    const result = resolveMemberPerimetres(
      [{ sirenGroupement: "250100001", sirenMembre: "210100038", categorieMembre: "commune", type: "SIVU" }],
      sirenToInsee,
      epciPerimetres,
    );
    expect(result).toEqual([{ sirenGroupement: "250100001", codeInseeCommune: "01003", categorieMembre: "commune" }]);
  });

  it("expands an EPCI member to the communes of the EPCI", () => {
    const result = resolveMemberPerimetres(
      [{ sirenGroupement: "250100001", sirenMembre: "200069193", categorieMembre: "groupement", type: "SMF" }],
      sirenToInsee,
      epciPerimetres,
    );
    expect(result.map((p) => p.codeInseeCommune).sort()).toEqual(["01001", "01002"]);
    expect(result.every((p) => p.sirenGroupement === "250100001")).toBe(true);
  });

  it("deduplicates a commune reached both directly and through its EPCI, and skips unknown members", () => {
    const result = resolveMemberPerimetres(
      [
        { sirenGroupement: "250100001", sirenMembre: "210100012", categorieMembre: "commune", type: "SMF" },
        { sirenGroupement: "250100001", sirenMembre: "200069193", categorieMembre: "groupement", type: "SMF" },
        { sirenGroupement: "250100001", sirenMembre: "999999999", categorieMembre: "autre", type: "SMF" },
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

describe("epciFromBanatic", () => {
  const sirenToInsee = new Map([
    ["210100012", "01001"],
    ["210100020", "01002"],
    ["217500016", "75056"],
  ]);
  const membre = (sirenGroupement: string, sirenMembre: string, type: string) => ({
    sirenGroupement,
    sirenMembre,
    categorieMembre: "commune",
    type,
  });

  it("gives each commune the EPCI à fiscalité propre it is a member of", () => {
    const epci = epciFromBanatic(
      [membre("992367730", "210100012", "CA"), membre("994579670", "210100020", "CC")],
      sirenToInsee,
    );
    expect(Object.fromEntries(epci)).toEqual({ "01001": "992367730", "01002": "994579670" });
  });

  it("ignores syndicats and EPT: a Grand Paris commune keeps the Métropole as its EPCI", () => {
    const epci = epciFromBanatic(
      [
        membre("200054781", "217500016", "METRO"),
        membre("200058014", "217500016", "EPT"),
        membre("250100001", "217500016", "SMF"),
      ],
      sirenToInsee,
    );
    expect(Object.fromEntries(epci)).toEqual({ "75056": "200054781" });
  });

  it("leaves out a commune Banatic puts in several EPCI à fiscalité propre (left to geo.api)", () => {
    const epci = epciFromBanatic(
      [membre("200069193", "210100012", "CC"), membre("200066587", "210100012", "CA")],
      sirenToInsee,
    );
    expect(epci.has("01001")).toBe(false);
  });
});
