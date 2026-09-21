// Résolution pure `collectiviteNom (TeT) → SIREN` à partir du référentiel
// (api_referentiel.groupements + communes). Aucun accès I/O : les données du
// référentiel sont passées en mémoire, ce qui rend la logique testable unitairement.
//
// Priorité : override audité (par collectiviteId) > match exact groupement (EPCI/PETR/EPT/
// syndicat) > match exact commune. Un nom qui matche PLUSIEURS entrées (homonymes,
// ex. « Saint-Denis ») est ambigu → non résolu ici (traité par override si connu).

import { SIREN_OVERRIDES } from "./overrides";

export interface RefEntry {
  siren: string;
  nom: string;
}

export interface ResolvedSiren {
  siren: string;
  source: string;
}

// Normalise un nom : sans accents, minuscule, ponctuation → espace, espaces compactés.
export function normalizeNom(nom: string | null | undefined): string {
  if (!nom) return "";
  return nom
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // diacritiques (U+0300–U+036F)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Index nom normalisé → ensemble de SIREN (pour détecter les homonymes).
export type NomIndex = Map<string, Set<string>>;

function buildIndex(entries: RefEntry[]): NomIndex {
  const idx: NomIndex = new Map();
  for (const e of entries) {
    const key = normalizeNom(e.nom);
    if (!key) continue;
    const set = idx.get(key) ?? new Set<string>();
    set.add(e.siren);
    idx.set(key, set);
  }
  return idx;
}

export interface Resolver {
  resolve(collectiviteId: number, collectiviteNom: string | null | undefined): ResolvedSiren | null;
}

export function buildResolver(groupements: RefEntry[], communes: RefEntry[]): Resolver {
  const grpIdx = buildIndex(groupements);
  const comIdx = buildIndex(communes);

  const uniqueSiren = (idx: NomIndex, key: string): string | null => {
    const set = idx.get(key);
    return set?.size === 1 ? [...set][0] : null;
  };

  return {
    resolve(collectiviteId, collectiviteNom) {
      // 1. Override audité (renommages, dept/région/syndicats, homonymes tranchés).
      const ov = SIREN_OVERRIDES[collectiviteId];
      if (ov) return { siren: ov.siren, source: ov.source };

      const key = normalizeNom(collectiviteNom);
      if (!key) return null;

      // 2. Groupement (EPCI/PETR/EPT/syndicat) : porteur typique d'un PCAET.
      const grp = uniqueSiren(grpIdx, key);
      if (grp) return { siren: grp, source: "groupement_exact" };

      // 3. Commune (sans match groupement) : plans portés au niveau communal.
      const com = uniqueSiren(comIdx, key);
      if (com) return { siren: com, source: "commune_exact" };

      return null;
    },
  };
}
