import { insufficientVolumes, MINIMUM_VOLUMES, type SeedVolumes } from "./volume-guard";

// Volumes of the 2026-10-21 production import
const nominal: SeedVolumes = {
  regions: 18,
  departements: 101,
  departementsWithSiren: 101,
  communes: 34875,
  communesWithSiret: 34875,
  communesWithBanaticEpci: 34871,
  groupements: 9275,
  perimetres: 392141,
  groupementCompetences: 50793,
};

describe("insufficientVolumes", () => {
  it("accepts the volumes of a nominal import", () => {
    expect(insufficientVolumes(nominal)).toEqual([]);
  });

  it("accepts volumes exactly at the minimum", () => {
    expect(insufficientVolumes(MINIMUM_VOLUMES)).toEqual([]);
  });

  it("refuses an import where geo.api returned too few communes", () => {
    expect(insufficientVolumes({ ...nominal, communes: 1200 })).toEqual([
      `communes: 1200 < ${MINIMUM_VOLUMES.communes}`,
    ]);
  });

  it("refuses an import where a Banatic regional export was skipped", () => {
    // Île-de-France missing: ~1 270 communes lose their EPCI from Banatic
    expect(insufficientVolumes({ ...nominal, communesWithBanaticEpci: 33600 })).toEqual([
      `communesWithBanaticEpci: 33600 < ${MINIMUM_VOLUMES.communesWithBanaticEpci}`,
    ]);
  });

  it("refuses an import where ZLV returned nothing", () => {
    expect(insufficientVolumes({ ...nominal, communesWithSiret: 0, departementsWithSiren: 0 })).toEqual([
      `departementsWithSiren: 0 < ${MINIMUM_VOLUMES.departementsWithSiren}`,
      `communesWithSiret: 0 < ${MINIMUM_VOLUMES.communesWithSiret}`,
    ]);
  });

  it("lists every volume under its minimum", () => {
    const empty = Object.fromEntries(Object.keys(nominal).map((k) => [k, 0])) as unknown as SeedVolumes;
    expect(insufficientVolumes(empty)).toHaveLength(Object.keys(nominal).length);
  });
});
