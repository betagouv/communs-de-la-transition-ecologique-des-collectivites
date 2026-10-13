// ============================================================
// Doctrine d'accès aux données — registre des sources restreintes
// ============================================================
//
// « Qui voit quoi ». Certaines sources de projets ne sont visibles que par les
// services de l'État qui détiennent le scope de données correspondant (voir
// docs/api/DOCTRINE_ACCES_DONNEES.md). On installe le mécanisme AVANT la donnée :
// le registre est VIDE aujourd'hui → aucune source restreinte → aucun filtrage,
// non-régression stricte.
//
// Clé   : source_origine (schema_commun_v2.projets_operationnels.source_origine).
// Valeur: scope requis, à présenter dans services.data_scopes du service appelant.

export const RESTRICTED_SOURCES: Record<string, string> = {
  // Ouverture DGCL à venir — la publication des dossiers NON financés est à la
  // discrétion des préfets ; l'accès sera conditionné à un scope dédié :
  // "DGCL non financés": "dgcl_non_finances",
};

/**
 * Sources restreintes que le service appelant N'A PAS le droit de voir, compte tenu
 * de ses scopes. Fonction pure (le registre est injectable pour les tests).
 * Registre vide → `[]` (aucune restriction, aucun filtre à appliquer).
 */
export function forbiddenSourcesFor(
  callerScopes: readonly string[],
  registry: Record<string, string> = RESTRICTED_SOURCES,
): string[] {
  return Object.entries(registry)
    .filter(([, requiredScope]) => !callerScopes.includes(requiredScope))
    .map(([source]) => source);
}

/** Vrai si au moins une source est restreinte (permet de court-circuiter tout lookup). */
export function hasRestrictedSources(registry: Record<string, string> = RESTRICTED_SOURCES): boolean {
  return Object.keys(registry).length > 0;
}

// ============================================================
// Base consolidée (/consultation) — registre distinct
// ============================================================
//
// Clé   : data_projets_consolides.projets_sources.source (provenance d'une trace).
// Valeur: scope requis, à présenter dans services.data_scopes du service appelant.
//
// Distinct de RESTRICTED_SOURCES : autre table, autres clients (/territoires sert TeT,
// qui doit continuer à voir ses propres fiches). Une source est listée ici tant que son
// propriétaire n'a pas donné son accord pour les services de l'État ; l'accord obtenu,
// on la retire (ou on donne le scope au client concerné). Décision du 13/10/2026.
export const CONSOLIDATED_RESTRICTED_SOURCES: Record<string, string> = {
  // TeT : fiches internes, accès refusé.
  "fiches-projets": "tet",
  // ANCT : à négocier, gelé.
  "communs-pvd": "anct_contractualisation",
  "communs-acv": "anct_contractualisation",
  "villages-avenir": "anct_contractualisation",
  // COP : gelé.
  "communs-vivier-cop": "cop",
};
