import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { sql } from "drizzle-orm";

// Dashboard TE API — raw SQL queries against schema_commun_v2 + snapshot_crte + api_referentiel.
// Called by the dashboard-te Cloudflare Worker (static SPA proxy) via API key.

type Row = Record<string, unknown>;

@Injectable()
export class DashboardTeService {
  constructor(private readonly db: DatabaseService) {}

  private async query<T = Row>(q: ReturnType<typeof sql>): Promise<T[]> {
    const result = await this.db.database.execute(q);
    return result.rows as T[];
  }

  /**
   * Rich national statistics matching V2's `StatsNational` shape.
   * Returns totals, plus aggregations parSource/parPhase/parDepartement/etc.
   */
  async statsNational() {
    // Totals
    const [totalsRow] = await this.query<{
      totalProjets: string;
      totalBudget: string;
      totalCollectivites: string;
      totalPlans: string;
      totalFiches: string;
      totalFinancements: string;
      totalFinancementAttribue: string;
      totalFinancementPaye: string;
    }>(sql`
      SELECT
        (SELECT count(*) FROM schema_commun_v2.projets_operationnels)::text AS "totalProjets",
        (SELECT COALESCE(SUM(CAST(NULLIF("budgetPrevisionnel", '') AS numeric)), 0)
          FROM schema_commun_v2.projets_operationnels)::text AS "totalBudget",
        (SELECT count(DISTINCT "collectiviteResponsableSiren")
          FROM schema_commun_v2.projets_operationnels
          WHERE "collectiviteResponsableSiren" IS NOT NULL)::text AS "totalCollectivites",
        (SELECT count(*) FROM schema_commun_v2.plans_transition)::text AS "totalPlans",
        (SELECT count(*) FROM schema_commun_v2.fiches_action)::text AS "totalFiches",
        (SELECT count(*) FROM schema_commun_v2.financements)::text AS "totalFinancements",
        (SELECT COALESCE(SUM(CAST(NULLIF("montantAttribue", '') AS numeric)), 0)
          FROM schema_commun_v2.financements)::text AS "totalFinancementAttribue",
        (SELECT COALESCE(SUM(CAST(NULLIF("montantPaye", '') AS numeric)), 0)
          FROM schema_commun_v2.financements)::text AS "totalFinancementPaye"
    `);

    // Cluster aggregates
    const [clusterRow] = await this.query<{
      totalClusters: string;
      totalProjetsInClusters: string;
      totalFichesLiees: string;
    }>(sql`
      SELECT
        (SELECT count(*) FROM schema_commun_v2.clusters)::text AS "totalClusters",
        (SELECT count(*) FROM schema_commun_v2.clusters_membres WHERE projet_id IS NOT NULL)::text AS "totalProjetsInClusters",
        (SELECT count(*) FROM schema_commun_v2.clusters_membres WHERE fiche_action_id IS NOT NULL)::text AS "totalFichesLiees"
    `);

    const clusterSizesRows = await this.query<{ taille: number; nb: string }>(sql`
      SELECT taille, count(*)::text AS nb
      FROM schema_commun_v2.clusters
      GROUP BY taille
      ORDER BY taille
    `);
    const clusterSizes: Record<string, number> = {};
    for (const r of clusterSizesRows) clusterSizes[String(r.taille)] = Number(r.nb);

    // By source
    const parSource = await this.query<{ source: string; count: string; budget: string }>(sql`
      SELECT source_origine AS source, count(*)::text AS count,
        COALESCE(SUM(CAST(NULLIF("budgetPrevisionnel", '') AS numeric)), 0)::text AS budget
      FROM schema_commun_v2.projets_operationnels
      WHERE source_origine IS NOT NULL
      GROUP BY source_origine
      ORDER BY count(*) DESC
    `);

    // By phase
    const parPhase = await this.query<{ phase: string; count: string; budget: string }>(sql`
      SELECT COALESCE(NULLIF(phase, ''), 'Non renseigné') AS phase,
        count(*)::text AS count,
        COALESCE(SUM(CAST(NULLIF("budgetPrevisionnel", '') AS numeric)), 0)::text AS budget
      FROM schema_commun_v2.projets_operationnels
      GROUP BY phase
      ORDER BY count(*) DESC
    `);

    // By department — join projets → liens_projets_communes → api_referentiel.communes
    const parDepartement = await this.query<{
      code: string;
      nom: string;
      region: string;
      nbProjets: string;
      nbCollectivites: string;
      budgetTotal: string;
      nbPlans: string;
    }>(sql`
      WITH projet_dept AS (
        SELECT DISTINCT p.id, p."collectiviteResponsableSiren", p."budgetPrevisionnel",
          ar.code_departement AS code_dept, ar.code_region AS code_reg
        FROM schema_commun_v2.projets_operationnels p
        JOIN schema_commun_v2.liens_projets_communes lpc ON lpc.projet_id = p.id
        JOIN api_referentiel.communes ar ON ar.code_insee = lpc.insee_com
        WHERE ar.code_departement IS NOT NULL
      )
      SELECT code_dept AS code,
        code_dept AS nom,
        COALESCE(MAX(code_reg), '') AS region,
        count(DISTINCT id)::text AS "nbProjets",
        count(DISTINCT "collectiviteResponsableSiren")::text AS "nbCollectivites",
        COALESCE(SUM(CAST(NULLIF("budgetPrevisionnel", '') AS numeric)), 0)::text AS "budgetTotal",
        0::text AS "nbPlans"
      FROM projet_dept
      GROUP BY code_dept
      ORDER BY code_dept
    `);

    // Top leviers SGPE (text[] array unnested)
    const parLevier = await this.query<{ levier: string; count: string }>(sql`
      SELECT levier, count(*)::text AS count
      FROM schema_commun_v2.projets_operationnels, UNNEST(
        string_to_array("leviersSgpe", ',')
      ) AS levier
      WHERE levier IS NOT NULL AND trim(levier) <> ''
      GROUP BY levier
      ORDER BY count(*) DESC
      LIMIT 20
    `);

    // Top competences M57
    const parCompetence = await this.query<{ code: string; count: string }>(sql`
      SELECT code, count(*)::text AS count
      FROM schema_commun_v2.projets_operationnels, UNNEST(
        string_to_array("competencesM57", ',')
      ) AS code
      WHERE code IS NOT NULL AND trim(code) <> ''
      GROUP BY code
      ORDER BY count(*) DESC
      LIMIT 20
    `);

    // Financements par source
    const parSourceFinancement = await this.query<{
      source: string;
      count: string;
      totalAttribue: string;
    }>(sql`
      SELECT source, count(*)::text AS count,
        COALESCE(SUM(CAST(NULLIF("montantAttribue", '') AS numeric)), 0)::text AS "totalAttribue"
      FROM schema_commun_v2.financements
      WHERE source IS NOT NULL
      GROUP BY source
      ORDER BY SUM(CAST(NULLIF("montantAttribue", '') AS numeric)) DESC NULLS LAST
      LIMIT 20
    `);

    return {
      totalProjets: Number(totalsRow.totalProjets ?? 0),
      totalBudget: Number(totalsRow.totalBudget ?? 0),
      totalCollectivites: Number(totalsRow.totalCollectivites ?? 0),
      totalPlans: Number(totalsRow.totalPlans ?? 0),
      totalFiches: Number(totalsRow.totalFiches ?? 0),
      totalFinancements: Number(totalsRow.totalFinancements ?? 0),
      totalFinancementAttribue: Number(totalsRow.totalFinancementAttribue ?? 0),
      totalFinancementPaye: Number(totalsRow.totalFinancementPaye ?? 0),
      clusters: {
        totalClusters: Number(clusterRow.totalClusters ?? 0),
        totalProjetsInClusters: Number(clusterRow.totalProjetsInClusters ?? 0),
        totalFichesLiees: Number(clusterRow.totalFichesLiees ?? 0),
        clusterSizes,
      },
      parSource: parSource.map((r) => ({
        source: r.source,
        count: Number(r.count),
        budget: Number(r.budget),
      })),
      parPhase: parPhase.map((r) => ({
        phase: r.phase,
        count: Number(r.count),
        budget: Number(r.budget),
      })),
      parDepartement: parDepartement.map((r) => ({
        code: r.code,
        nom: r.nom,
        region: r.region,
        nbProjets: Number(r.nbProjets),
        nbCollectivites: Number(r.nbCollectivites),
        budgetTotal: Number(r.budgetTotal),
        nbPlans: Number(r.nbPlans),
      })),
      parSourceFinancement: parSourceFinancement.map((r) => ({
        source: r.source,
        count: Number(r.count),
        totalAttribue: Number(r.totalAttribue),
      })),
      parLevier: parLevier.map((r) => ({ levier: r.levier, count: Number(r.count) })),
      parCompetence: parCompetence.map((r) => ({
        code: r.code,
        label: r.code,
        count: Number(r.count),
      })),
    };
  }

  async collectivites(params: { region?: string; departement?: string; page: number; limit: number }) {
    const { region, departement, page, limit } = params;
    return this.query(sql`
      SELECT siren, nom, 'Commune' AS type, code_insee, code_epci, code_departement, code_region, population
      FROM api_referentiel.communes
      WHERE 1=1
        ${departement ? sql`AND code_departement = ${departement}` : sql``}
        ${region ? sql`AND code_region = ${region}` : sql``}
      ORDER BY nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);
  }

  async collectivite(siren: string) {
    const [commune] = await this.query(sql`SELECT * FROM api_referentiel.communes WHERE siren = ${siren} LIMIT 1`);
    const [groupement] = await this.query(
      sql`SELECT * FROM api_referentiel.groupements WHERE siren = ${siren} LIMIT 1`,
    );
    const projets = await this.query(sql`
      SELECT id, nom, source_origine, "classificationThematiques" AS thematiques
      FROM schema_commun_v2.projets_operationnels
      WHERE "collectiviteResponsableSiren" = ${siren}
      LIMIT 200
    `);
    const fiches = await this.query(sql`
      SELECT id, nom, source_origine, "classificationThematiques" AS thematiques
      FROM schema_commun_v2.fiches_action
      WHERE "collectiviteResponsableSiren" = ${siren}
      LIMIT 200
    `);
    return { siren, commune: commune ?? null, groupement: groupement ?? null, projets, fiches };
  }

  async projets(params: { commune?: string; q?: string; page: number; limit: number }) {
    const { commune, q, page, limit } = params;
    const pattern = q ? `%${q}%` : null;
    return this.query(sql`
      SELECT DISTINCT p.id, p.nom, p.source_origine, p."collectiviteResponsableSiren" AS siren
      FROM schema_commun_v2.projets_operationnels p
      ${
        commune
          ? sql`JOIN schema_commun_v2.liens_projets_communes lpc ON lpc.projet_id = p.id WHERE lpc.insee_com = ${commune}`
          : pattern
            ? sql`WHERE p.nom ILIKE ${pattern}`
            : sql``
      }
      ${commune && pattern ? sql`AND p.nom ILIKE ${pattern}` : sql``}
      ORDER BY p.nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);
  }

  async fiches(params: { plan?: string; commune?: string; page: number; limit: number }) {
    const { plan, commune, page, limit } = params;
    return this.query(sql`
      SELECT DISTINCT f.id, f.nom, f.source_origine, f."collectiviteResponsableSiren" AS siren
      FROM schema_commun_v2.fiches_action f
      ${
        plan
          ? sql`JOIN schema_commun_v2.liens_plans_fiches lpf ON lpf.fiche_action_id = f.id WHERE lpf.plan_id = ${plan}`
          : commune
            ? sql`WHERE f."collectiviteResponsableSiren" IN (SELECT siren FROM api_referentiel.communes WHERE code_insee = ${commune})`
            : sql``
      }
      ORDER BY f.nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);
  }

  async plans(params: { siren?: string; crte?: string; page: number; limit: number }) {
    const { siren, crte, page, limit } = params;
    return this.query(sql`
      SELECT id, nom, type, "collectiviteResponsableSiren" AS siren, source, id_crte
      FROM schema_commun_v2.plans_transition
      WHERE 1=1
        ${siren ? sql`AND "collectiviteResponsableSiren" = ${siren}` : sql``}
        ${crte ? sql`AND id_crte = ${crte}` : sql``}
      ORDER BY nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);
  }

  async plan(id: string) {
    const [plan] = await this.query(sql`
      SELECT p.*, c.lib_crte AS crte_nom, c.date_signature AS crte_date_signature
      FROM schema_commun_v2.plans_transition p
      LEFT JOIN snapshot_crte.contrats c ON c.id_crte = p.id_crte
      WHERE p.id = ${id}
      LIMIT 1
    `);
    if (!plan) return null;
    const [{ count }] = await this.query<{ count: string }>(sql`
      SELECT count(*) FROM schema_commun_v2.liens_plans_fiches WHERE plan_id = ${id}
    `);
    return { ...plan, fiches_count: Number(count) };
  }

  planCommunes(id: string) {
    return this.query(sql`
      SELECT ar.code_insee, ar.nom, ar.code_departement, ar.code_region
      FROM schema_commun_v2.liens_plans_communes lpc
      JOIN api_referentiel.communes ar ON ar.code_insee = lpc.insee_com
      WHERE lpc.plan_id = ${id}
      ORDER BY ar.nom
    `);
  }

  planGroupements(id: string) {
    return this.query(sql`
      SELECT ar.siren, ar.nom, ar.nature_juridique
      FROM schema_commun_v2.liens_plans_groupements lpg
      JOIN api_referentiel.groupements ar ON ar.siren = lpg.siren_groupement
      WHERE lpg.plan_id = ${id}
      ORDER BY ar.nom
    `);
  }

  clusters(params: { confidence?: string; page: number; limit: number }) {
    const { confidence, page, limit } = params;
    return this.query(sql`
      SELECT id, confiance, taille
      FROM schema_commun_v2.clusters
      ${confidence ? sql`WHERE confiance = ${confidence}` : sql``}
      ORDER BY taille DESC, id
      LIMIT ${limit} OFFSET ${page * limit}
    `);
  }

  async cluster(id: string) {
    const [cluster] = await this.query(
      sql`SELECT id, confiance, taille FROM schema_commun_v2.clusters WHERE id = ${id} LIMIT 1`,
    );
    if (!cluster) return null;
    const projets = await this.query(sql`
      SELECT p.id, p.nom, p.source_origine, p."collectiviteResponsableSiren" AS siren
      FROM schema_commun_v2.clusters_membres cm
      JOIN schema_commun_v2.projets_operationnels p ON p.id = cm.projet_id
      WHERE cm.cluster_id = ${id}
    `);
    const fiches = await this.query(sql`
      SELECT f.id, f.nom, f.source_origine, f."collectiviteResponsableSiren" AS siren
      FROM schema_commun_v2.clusters_membres cm
      JOIN schema_commun_v2.fiches_action f ON f.id = cm.fiche_action_id
      WHERE cm.cluster_id = ${id}
    `);
    return { ...cluster, projets, fiches };
  }

  async crte(id: string) {
    const [c] = await this.query(sql`SELECT * FROM snapshot_crte.contrats WHERE id_crte = ${id} LIMIT 1`);
    if (!c) return null;
    const groupements = await this.query(sql`
      SELECT siren_groupement, lib_groupement, nature_juridique, lib_reg, lib_dep
      FROM snapshot_crte.groupements WHERE id_crte = ${id}
    `);
    const communes = await this.query(sql`
      SELECT insee_com, lib_com FROM snapshot_crte.communes WHERE id_crte = ${id}
    `);
    return { ...c, groupements, communes };
  }

  crteList(params: { region?: string; departement?: string; siren?: string }) {
    const { region, departement, siren } = params;
    const useJoin = Boolean(region ?? departement ?? siren);
    return this.query(sql`
      SELECT DISTINCT c.id_crte, c.lib_crte, c.date_signature
      FROM snapshot_crte.contrats c
      ${
        useJoin
          ? sql`LEFT JOIN snapshot_crte.groupements g ON g.id_crte = c.id_crte WHERE 1=1
        ${region ? sql`AND g.insee_reg = ${region}` : sql``}
        ${departement ? sql`AND g.dep_chef_file = ${departement}` : sql``}
        ${siren ? sql`AND g.siren_groupement = ${siren}` : sql``}
      `
          : sql``
      }
      ORDER BY c.lib_crte
      LIMIT 200
    `);
  }

  communePlans(insee: string) {
    return this.query(sql`
      SELECT p.id, p.nom, p.type, p.source, p.id_crte
      FROM schema_commun_v2.liens_plans_communes lpc
      JOIN schema_commun_v2.plans_transition p ON p.id = lpc.plan_id
      WHERE lpc.insee_com = ${insee}
    `);
  }
}
