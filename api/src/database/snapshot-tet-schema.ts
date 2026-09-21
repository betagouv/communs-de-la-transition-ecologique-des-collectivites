import { integer, jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

// ============================================================
// Schema: snapshot_tet_api — snapshot des plans/fiches publics de TeT
// Reconstruit par nous depuis l'API tRPC TeT (collectivites.recherches.plans).
// Ce schéma N'EST PAS alimenté par un autre process : le script
// scripts/rebuild-tet-snapshot/ en est la seule source.
//
// Les tables préexistent en prod (créées hors migrations) ; la migration
// 0050 ne fait qu'AJOUTER les colonnes de résolution SIREN sur `plans`.
// ============================================================

export const snapshotTetApiSchema = pgSchema("snapshot_tet_api");

export const snapshotTetPlans = snapshotTetApiSchema.table("plans", {
  // Id interne du plan côté TeT (= planId, brique du deep-link /plans/:planId).
  planId: integer("plan_id").primaryKey(),
  planNom: text("plan_nom"),
  planType: text("plan_type"),
  // Id interne de la collectivité côté TeT (= collectiviteId, deep-link /collectivite/:id/...).
  collectiviteId: integer("collectivite_id"),
  collectiviteNom: text("collectivite_nom"),
  contacts: jsonb("contacts"),

  // Résolution SIREN du porteur (ajoutée par la migration 0050). L'API TeT ne fournit
  // pas le SIREN : on le résout à la reconstruction depuis collectiviteNom via
  // api_referentiel (+ overrides audités). Nécessaire pour placer le plan sur un
  // territoire (SIREN → communes) dans la matview pcaet_reference possédée.
  siren: text("siren"),
  // Méthode de résolution (groupement_exact | commune_exact | fuzzy_epci | web* | commune_* | ...).
  sirenSource: text("siren_source"),
  sirenResolvedAt: timestamp("siren_resolved_at", { withTimezone: true }),

  fetchedAt: timestamp("fetched_at"),
});
