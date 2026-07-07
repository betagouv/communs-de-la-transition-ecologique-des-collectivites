import { index, jsonb, pgSchema, text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

// ============================================================
// Schema: decisions_humaines — Persistent human decisions
// ============================================================
//
// Append-only event log of human decisions (MEC, TeT, DDT agents, internal)
// about objects of schema_commun_v2 (projects, fiches, plans, financements).
//
// CRITICAL INVARIANTS:
// - This schema lives OUTSIDE the schema_commun_v2 blue-green rebuild cycle:
//   decisions MUST survive every ETL re-run.
// - Append-only at the application level: never UPDATE / DELETE. A revocation is
//   a NEW event that points, via `supersedes`, to the older event it revokes.
//   (The pointer is on the new row, so no existing row is ever mutated.)
// - objet_*_id always reference STABLE object IDs (source UUIDs, cop_* ids…),
//   NEVER cluster ids (cluster ids are recomputed on every pipeline run).

export const decisionsHumainesSchema = pgSchema("decisions_humaines");

export const decisions = decisionsHumainesSchema.table(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // lien_confirme | lien_infirme | doublon_signale | projet_valide | projet_obsolete | rattachement_pcaet | …
    typeDecision: text("type_decision").notNull(),
    // projet | fiche_action | plan | financement
    objetAType: text("objet_a_type").notNull(),
    objetAId: text("objet_a_id").notNull(),
    // For binary decisions (links between two objects)
    objetBType: text("objet_b_type"),
    objetBId: text("objet_b_id"),
    // confirme | infirme | fusionner | …
    verdict: text("verdict"),
    // Agent identifier if transmitted by the platform
    auteur: text("auteur"),
    // MEC | TET | interne — validated against the authenticated service
    plateformeSource: text("plateforme_source").notNull(),
    commentaire: text("commentaire"),
    payload: jsonb("payload"),
    // Revocation chain: THIS (new) event supersedes an older one it points to.
    // The pointer lives on the new row → append-only preserved (no UPDATE/DELETE).
    supersedes: uuid("supersedes").references((): AnyPgColumn => decisions.id),
  },
  (t) => [
    index("decisions_objet_a_idx").on(t.objetAId),
    index("decisions_objet_b_idx").on(t.objetBId),
    index("decisions_type_created_idx").on(t.typeDecision, t.createdAt),
  ],
);
