import { sql, SQL } from "drizzle-orm";
import { ANNULE_VERDICT } from "./decision-contract";

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

/**
 * Prédicat SQL à injecter dans un WHERE : exclut les décisions « pierre tombale »
 * (verdict='annule'), qui ne servent qu'à révoquer leur cible via `supersedes` et
 * n'affirment rien. À combiner avec `activeDecisionPredicate` dans tout effet de
 * lecture (decisions[], rattachement, obsolètes). `IS DISTINCT FROM` conserve les
 * verdicts NULL (aucun verdict ≠ annule).
 */
export const notTombstonePredicate = (alias = "d"): SQL =>
  sql`${sql.raw(alias)}.verdict IS DISTINCT FROM ${ANNULE_VERDICT}`;
