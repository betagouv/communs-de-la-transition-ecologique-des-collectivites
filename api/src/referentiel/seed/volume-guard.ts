// Guard against importing a truncated referentiel. The import replaces every ref_* table, so a
// source answering with partial data (a Banatic regional export failing, geo.api or ZLV returning
// an empty body) would silently wipe part of the referentiel. Below these volumes the import is
// refused and the current data is kept.

/** Volumes of a referentiel built from the sources, before import. */
export interface SeedVolumes {
  regions: number;
  departements: number;
  departementsWithSiren: number;
  communes: number;
  communesWithSiret: number;
  /** Communes whose EPCI comes from Banatic: drops when a regional export is skipped. */
  communesWithBanaticEpci: number;
  groupements: number;
  perimetres: number;
  groupementCompetences: number;
}

// Set from the 2026-10-21 production import (18 / 101 / 101 / 34 875 / 34 875 / 34 871 / 9 275 /
// 392 141 / 50 793), with room for commune mergers and dissolved syndicats over a few years.
export const MINIMUM_VOLUMES: SeedVolumes = {
  regions: 18,
  departements: 101,
  departementsWithSiren: 101,
  communes: 34000,
  communesWithSiret: 34000,
  communesWithBanaticEpci: 34000,
  groupements: 8500,
  perimetres: 350000,
  groupementCompetences: 45000,
};

/** One message per volume under its minimum, empty when the import can proceed. */
export function insufficientVolumes(volumes: SeedVolumes, minimum: SeedVolumes = MINIMUM_VOLUMES): string[] {
  return (Object.keys(minimum) as (keyof SeedVolumes)[])
    .filter((key) => volumes[key] < minimum[key])
    .map((key) => `${key}: ${volumes[key]} < ${minimum[key]}`);
}
