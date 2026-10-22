import { collectiviteSirensFromZlv, type ZlvRecord } from "./zlv.source";

const record = (kind: string, siren: string, depCode: string, regCode: string): ZlvRecord => ({
  Siren: siren,
  Siret: "",
  "Kind-admin": kind,
  "Name-source": kind,
  Dep_Code: depCode,
  Reg_Code: regCode,
});

describe("collectiviteSirensFromZlv", () => {
  it("maps each department and region code to the SIREN of its collectivity", () => {
    const { departements, regions } = collectiviteSirensFromZlv([
      record("DEP", "223400016", "['34']", "['76']"),
      record("REG", "200053791", "['09', '11', '34']", "['76']"),
      record("DEP", "217500016", "['75']", "['11']"),
    ]);
    expect(Object.fromEntries(departements)).toEqual({ "34": "223400016", "75": "217500016" });
    expect(Object.fromEntries(regions)).toEqual({ "76": "200053791" });
  });

  it("gives a territory merged into a collectivité unique the SIREN of that collectivity", () => {
    const { departements, regions } = collectiviteSirensFromZlv([
      record("DEP", "", "['2A']", "['94']"),
      record("DEP", "", "['2B']", "['94']"),
      record("ACT", "200076958", "['2A', '2B']", "['94']"),
      record("REG", "", "['976']", "['06']"),
      record("ACT", "229850003", "['976']", "['06']"),
    ]);
    expect(Object.fromEntries(departements)).toEqual({ "2A": "200076958", "2B": "200076958" });
    expect(Object.fromEntries(regions)).toEqual({ "06": "229850003" });
  });

  it("keeps the department's own SIREN over another collectivity on its territory", () => {
    const { departements } = collectiviteSirensFromZlv([
      record("DEP", "229740014", "['974']", "['04']"),
      record("ACT", "229840004", "['974']", "['04']"), // TAAF, administered from La Réunion
    ]);
    expect(departements.get("974")).toBe("229740014");
  });

  it("maps Bas-Rhin and Haut-Rhin, absent from ZLV, to the Collectivité européenne d'Alsace", () => {
    const { departements } = collectiviteSirensFromZlv([
      record("DEP", "", "['67']", "['44']"),
      record("DEP", "", "['68']", "['44']"),
    ]);
    expect(Object.fromEntries(departements)).toEqual({ "67": "200094332", "68": "200094332" });
  });

  it("ignores communes and groupements", () => {
    const { departements, regions } = collectiviteSirensFromZlv([
      record("COM", "210100012", "['01']", "['84']"),
      record("CA", "200066009", "['68']", "['44']"),
    ]);
    expect(departements.has("01")).toBe(false);
    expect(departements.has("68")).toBe(false);
    expect(regions.size).toBe(0);
  });
});
