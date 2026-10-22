// Derived figures of the groupements and communes, computed from Banatic memberships.
//
// Banatic's population and member count columns are not reliable as we parse them (one row per
// member, read on the first row: the population of the first member, the member count missing),
// so both are recomputed from the perimetres, which are exact for EPCI with own taxation (from
// geo.api.gouv.fr) and resolved commune by commune for syndicats.
import type { BanaticRawPerimetre } from "./sources/banatic.source";
import type { RawCommune, RawGroupement, RawPerimetre } from "./sources/types";

/**
 * Perimetres from Banatic member SIRENs, for every kind of groupement (EPCI, EPT, syndicats): a
 * commune member gives its INSEE code, an EPCI member gives all the communes of the EPCI
 * (syndicats mixtes often group EPCI, not communes). Unknown members are skipped; a commune
 * reached twice is kept once.
 */
export function resolveMemberPerimetres(
  banaticPerimetres: BanaticRawPerimetre[],
  sirenToInsee: Map<string, string>,
  epciPerimetres: Map<string, Set<string>>,
): RawPerimetre[] {
  const seen = new Set<string>();
  const result: RawPerimetre[] = [];
  const add = (sirenGroupement: string, codeInseeCommune: string, categorieMembre: string | null) => {
    const key = `${sirenGroupement}:${codeInseeCommune}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ sirenGroupement, codeInseeCommune, categorieMembre });
  };

  for (const bp of banaticPerimetres) {
    const codeInsee = sirenToInsee.get(bp.sirenMembre);
    if (codeInsee) {
      add(bp.sirenGroupement, codeInsee, bp.categorieMembre);
      continue;
    }
    for (const codeInseeEpci of epciPerimetres.get(bp.sirenMembre) ?? []) {
      add(bp.sirenGroupement, codeInseeEpci, bp.categorieMembre);
    }
  }
  return result;
}

/** Groupements with `population` and `nbCommunes` recomputed from their member communes. */
export function withMemberStats(
  groupements: RawGroupement[],
  perimetres: RawPerimetre[],
  communes: RawCommune[],
): RawGroupement[] {
  const populationByInsee = new Map(communes.map((c) => [c.codeInsee, c.population]));
  const stats = new Map<string, { population: number; nbCommunes: number }>();
  for (const p of perimetres) {
    const s = stats.get(p.sirenGroupement) ?? { population: 0, nbCommunes: 0 };
    s.population += populationByInsee.get(p.codeInseeCommune) ?? 0;
    s.nbCommunes += 1;
    stats.set(p.sirenGroupement, s);
  }
  return groupements.map((g) => {
    const s = stats.get(g.siren);
    return { ...g, population: s?.population ?? null, nbCommunes: s?.nbCommunes ?? null };
  });
}

/**
 * EPCI perimetres followed by the syndicat perimetres they do not already contain. Built by a
 * loop: spreading ~400 000 items into a single push() overflows the call stack.
 */
export function mergePerimetres(epciPerimetres: RawPerimetre[], syndicatPerimetres: RawPerimetre[]): RawPerimetre[] {
  const merged = [...epciPerimetres];
  const keys = new Set(merged.map((p) => `${p.sirenGroupement}:${p.codeInseeCommune}`));
  for (const p of syndicatPerimetres) {
    const key = `${p.sirenGroupement}:${p.codeInseeCommune}`;
    if (keys.has(key)) continue;
    keys.add(key);
    merged.push(p);
  }
  return merged;
}

// EPCI à fiscalité propre. An EPT is not one: a Grand Paris commune's EPCI is the Métropole.
const EPCI_FISCALITE_PROPRE = new Set(["CC", "CA", "CU", "MET", "METRO"]);

/**
 * EPCI à fiscalité propre of each commune according to Banatic (code INSEE -> SIREN). A commune
 * belongs to exactly one; one listed in several is left out, for geo.api to decide. Banatic
 * follows the prefectural decrees, while geo.api lags a year behind (INSEE composition of the
 * previous 1st January): checked on 2026-10-20, Banatic matched the INSEE 2026 composition for
 * every commune, geo.api the 2025 one.
 */
export function epciFromBanatic(
  banaticPerimetres: BanaticRawPerimetre[],
  sirenToInsee: Map<string, string>,
): Map<string, string> {
  const epciByInsee = new Map<string, string | null>();
  for (const p of banaticPerimetres) {
    if (!EPCI_FISCALITE_PROPRE.has(p.type)) continue;
    const codeInsee = sirenToInsee.get(p.sirenMembre);
    if (!codeInsee) continue;
    const current = epciByInsee.get(codeInsee);
    if (current === undefined) epciByInsee.set(codeInsee, p.sirenGroupement);
    else if (current !== p.sirenGroupement) epciByInsee.set(codeInsee, null); // several: ambiguous
  }
  const result = new Map<string, string>();
  for (const [codeInsee, siren] of epciByInsee) if (siren) result.set(codeInsee, siren);
  return result;
}
