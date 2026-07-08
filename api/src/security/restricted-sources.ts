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
