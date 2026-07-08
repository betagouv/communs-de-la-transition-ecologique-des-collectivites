import { sql, SQL } from "drizzle-orm";

// ============================================================
// Helper SQL réutilisable : « décision active »
// ============================================================
//
// Une décision est ACTIVE tant qu'AUCUNE autre décision ne la supersède (la chaîne
// de révocation est append-only : le nouvel événement pointe vers l'ancien via
// `supersedes`, aucune ligne n'est jamais mutée).
//
// En cas de décisions actives CONTRADICTOIRES sur les mêmes objets (deux verdicts
// concurrents non reliés par `supersedes`), la résolution « la plus récente prime »
// se fait au point d'appel via `DISTINCT ON (<clé>) ... ORDER BY <clé>, created_at DESC`.
// Ce prédicat ne tranche PAS les contradictions : il ne fait qu'exclure les décisions révoquées.

/**
 * Prédicat SQL à injecter dans un WHERE de requête raw : vrai si la décision d'alias
 * `alias` n'est supersédée par aucune autre. `alias` est un identifiant SQL interne
 * (jamais une entrée utilisateur).
 *
 * Exemple : `WHERE d.type_decision = 'projet_statut' AND ${activeDecisionPredicate("d")}`.
 */
export const activeDecisionPredicate = (alias = "d"): SQL =>
  sql`NOT EXISTS (
    SELECT 1 FROM decisions_humaines.decisions sup
    WHERE sup.supersedes = ${sql.raw(alias)}.id
  )`;
