import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { sql, SQL } from "drizzle-orm";

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

  /**
   * Per-department aggregated stats. Used by DepartementPage KPIs + breakdowns.
   */
  async statsDepartement(code: string) {
    const [row] = await this.query<{
      code: string;
      nbProjets: string;
      nbCollectivites: string;
      nbPlans: string;
      budgetTotal: string;
    }>(sql`
      WITH projet_dept AS (
        SELECT DISTINCT p.id, p."collectiviteResponsableSiren", p."budgetPrevisionnel"
        FROM schema_commun_v2.projets_operationnels p
        JOIN schema_commun_v2.liens_projets_communes lpc ON lpc.projet_id = p.id
        JOIN api_referentiel.communes ar ON ar.code_insee = lpc.insee_com
        WHERE ar.code_departement = ${code}
      ),
      plan_dept AS (
        SELECT DISTINCT pl.id
        FROM schema_commun_v2.plans_transition pl
        JOIN schema_commun_v2.liens_plans_communes lpc ON lpc.plan_id = pl.id
        JOIN api_referentiel.communes ar ON ar.code_insee = lpc.insee_com
        WHERE ar.code_departement = ${code}
      )
      SELECT
        ${code}::text AS code,
        (SELECT count(*) FROM projet_dept)::text AS "nbProjets",
        (SELECT count(DISTINCT "collectiviteResponsableSiren") FROM projet_dept)::text AS "nbCollectivites",
        (SELECT count(*) FROM plan_dept)::text AS "nbPlans",
        (SELECT COALESCE(SUM(CAST(NULLIF("budgetPrevisionnel", '') AS numeric)), 0) FROM projet_dept)::text AS "budgetTotal"
    `);

    const parSource = await this.query<{ source: string; count: string }>(sql`
      SELECT p.source_origine AS source, count(DISTINCT p.id)::text AS count
      FROM schema_commun_v2.projets_operationnels p
      JOIN schema_commun_v2.liens_projets_communes lpc ON lpc.projet_id = p.id
      JOIN api_referentiel.communes ar ON ar.code_insee = lpc.insee_com
      WHERE ar.code_departement = ${code} AND p.source_origine IS NOT NULL
      GROUP BY p.source_origine
      ORDER BY count(DISTINCT p.id) DESC
    `);

    return {
      code,
      nbProjets: Number(row?.nbProjets ?? 0),
      nbCollectivites: Number(row?.nbCollectivites ?? 0),
      nbPlans: Number(row?.nbPlans ?? 0),
      budgetTotal: Number(row?.budgetTotal ?? 0),
      parSource: parSource.map((r) => ({ source: r.source, count: Number(r.count) })),
    };
  }

  async collectivites(params: { region?: string; departement?: string; q?: string; page: number; limit: number }) {
    const { region, departement, q, page, limit } = params;
    const pattern = q ? `%${q}%` : null;
    return this.query(sql`
      SELECT siren, nom, 'Commune' AS type, code_insee, code_epci,
        code_departement AS "codeDepartement", code_region AS "codeRegion",
        population
      FROM api_referentiel.communes
      WHERE 1=1
        ${departement ? sql`AND code_departement = ${departement}` : sql``}
        ${region ? sql`AND code_region = ${region}` : sql``}
        ${pattern ? sql`AND nom ILIKE ${pattern}` : sql``}
      ORDER BY nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);
  }

  async collectivite(siren: string) {
    const [commune] = await this.query(sql`SELECT * FROM api_referentiel.communes WHERE siren = ${siren} LIMIT 1`);
    const [groupement] = await this.query(
      sql`SELECT * FROM api_referentiel.groupements WHERE siren = ${siren} LIMIT 1`,
    );

    // Count projets / plans / fiches to avoid loading full lists (pagination used for lists)
    const [{ nbProjets }] = await this.query<{ nbProjets: string }>(sql`
      SELECT count(*)::text AS "nbProjets"
      FROM schema_commun_v2.projets_operationnels
      WHERE "collectiviteResponsableSiren" = ${siren}
    `);
    const [{ nbPlans }] = await this.query<{ nbPlans: string }>(sql`
      SELECT count(*)::text AS "nbPlans"
      FROM schema_commun_v2.plans_transition
      WHERE "collectiviteResponsableSiren" = ${siren}
    `);
    const [{ nbFiches }] = await this.query<{ nbFiches: string }>(sql`
      SELECT count(*)::text AS "nbFiches"
      FROM schema_commun_v2.fiches_action
      WHERE "collectiviteResponsableSiren" = ${siren}
    `);

    return {
      siren,
      commune: commune ?? null,
      groupement: groupement ?? null,
      nbProjets: Number(nbProjets),
      nbPlans: Number(nbPlans),
      nbFiches: Number(nbFiches),
    };
  }

  async projets(params: {
    commune?: string;
    departement?: string;
    siren?: string;
    levier?: string;
    competence?: string;
    source?: string;
    phase?: string;
    q?: string;
    page: number;
    limit: number;
  }) {
    const { commune, departement, siren, levier, competence, source, phase, q, page, limit } = params;
    const pattern = q ? `%${q}%` : null;
    const leviersPattern = levier ? `%${levier}%` : null;
    const competencesPattern = competence ? `%${competence}%` : null;

    const conditions: SQL[] = [];
    if (commune) conditions.push(sql`lpc.insee_com = ${commune}`);
    if (departement) conditions.push(sql`ar.code_departement = ${departement}`);
    if (siren) conditions.push(sql`p."collectiviteResponsableSiren" = ${siren}`);
    if (source) conditions.push(sql`p.source_origine = ${source}`);
    if (phase) conditions.push(sql`p.phase = ${phase}`);
    if (pattern) conditions.push(sql`p.nom ILIKE ${pattern}`);
    if (leviersPattern) conditions.push(sql`p."leviersSgpe" ILIKE ${leviersPattern}`);
    if (competencesPattern) conditions.push(sql`p."competencesM57" ILIKE ${competencesPattern}`);

    const needsCommuneJoin = Boolean(commune ?? departement);

    let whereClause = sql``;
    if (conditions.length > 0) {
      whereClause = sql`WHERE `;
      for (let i = 0; i < conditions.length; i++) {
        if (i > 0) whereClause = sql`${whereClause} AND `;
        whereClause = sql`${whereClause}${conditions[i]}`;
      }
    }

    const items = await this.query(sql`
      SELECT DISTINCT
        p.id,
        p.nom,
        p.description,
        p.source_origine AS "sourceOrigine",
        p.phase,
        p."phaseStatut",
        CAST(NULLIF(p."budgetPrevisionnel", '') AS numeric) AS "budgetPrevisionnel",
        p."collectiviteResponsableSiren" AS "collectiviteSiren",
        p."competencesM57",
        p."leviersSgpe",
        p."classificationThematiques",
        p.llm_sites->0->>'label' AS "llmSite",
        p.llm_sites->0->>'nom_propre' AS "llmSiteNomPropre",
        cm.cluster_id AS "clusterId",
        c.confiance AS "clusterConfiance"
      FROM schema_commun_v2.projets_operationnels p
      ${needsCommuneJoin ? sql`JOIN schema_commun_v2.liens_projets_communes lpc ON lpc.projet_id = p.id` : sql``}
      ${departement ? sql`JOIN api_referentiel.communes ar ON ar.code_insee = lpc.insee_com` : sql``}
      LEFT JOIN schema_commun_v2.clusters_membres cm ON cm.projet_id = p.id
      LEFT JOIN schema_commun_v2.clusters c ON c.id = cm.cluster_id
      ${whereClause}
      ORDER BY p.nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);

    return items;
  }

  /**
   * Full project detail with financements, cluster, linked plans, and collectivite.
   */
  async projet(id: string) {
    const [projet] = await this.query(sql`
      SELECT
        p.id,
        p.nom,
        p.description,
        p.source_origine AS "sourceOrigine",
        p.phase,
        p."phaseStatut",
        CAST(NULLIF(p."budgetPrevisionnel", '') AS numeric) AS "budgetPrevisionnel",
        p."dateDebut",
        p."dateFin",
        p."localisationAdresse" AS adresse,
        p."localisationLatitude" AS latitude,
        p."localisationLongitude" AS longitude,
        p."collectiviteResponsableSiren" AS "collectiviteSiren",
        p."competencesM57",
        p."leviersSgpe",
        p."classificationThematiques",
        p.llm_sites->0->>'label' AS "llmSite",
        p.llm_sites->0->>'nom_propre' AS "llmSiteNomPropre",
        p.llm_interventions->0->>'label' AS "llmIntervention",
        p.llm_thematiques->0->>'label' AS "llmThematique",
        cm.cluster_id AS "clusterId",
        c.confiance AS "clusterConfiance"
      FROM schema_commun_v2.projets_operationnels p
      LEFT JOIN schema_commun_v2.clusters_membres cm ON cm.projet_id = p.id
      LEFT JOIN schema_commun_v2.clusters c ON c.id = cm.cluster_id
      WHERE p.id = ${id}
      LIMIT 1
    `);
    if (!projet) return null;

    const financements = await this.query(
      sql`
      SELECT id, source,
        CAST(NULLIF("montantDemande", '') AS numeric) AS "montantDemande",
        CAST(NULLIF("montantAttribue", '') AS numeric) AS "montantAttribue",
        CAST(NULLIF("montantPaye", '') AS numeric) AS "montantPaye",
        statut
      FROM schema_commun_v2.financements
      WHERE "projetId" = ${id} OR projet_id = ${id}
    `,
    ).catch(() => [] as Row[]);

    const collectiviteSiren = (projet as { collectiviteSiren?: string }).collectiviteSiren;
    const [collectivite] = collectiviteSiren
      ? await this.query(sql`
        SELECT siren, nom, code_departement AS "codeDepartement", code_region AS "codeRegion", population
        FROM api_referentiel.communes
        WHERE siren = ${collectiviteSiren}
        LIMIT 1
      `)
      : [null];

    const linkedPlans = await this.query(sql`
      SELECT pl.id, pl.nom, pl.type
      FROM schema_commun_v2.liens_projets_communes lpc1
      JOIN schema_commun_v2.liens_plans_communes lpc2 ON lpc2.insee_com = lpc1.insee_com
      JOIN schema_commun_v2.plans_transition pl ON pl.id = lpc2.plan_id
      WHERE lpc1.projet_id = ${id}
      LIMIT 10
    `);

    return {
      ...projet,
      financements,
      collectivite: collectivite ?? null,
      linkedPlans,
    };
  }

  async fiches(params: { plan?: string; commune?: string; siren?: string; q?: string; page: number; limit: number }) {
    const { plan, commune, siren, q, page, limit } = params;
    const pattern = q ? `%${q}%` : null;

    const conditions: SQL[] = [];
    if (siren) conditions.push(sql`f."collectiviteResponsableSiren" = ${siren}`);
    if (commune)
      conditions.push(
        sql`f."collectiviteResponsableSiren" IN (SELECT siren FROM api_referentiel.communes WHERE code_insee = ${commune})`,
      );
    if (pattern) conditions.push(sql`f.nom ILIKE ${pattern}`);

    let whereClause = sql``;
    if (conditions.length > 0) {
      whereClause = sql`WHERE `;
      for (let i = 0; i < conditions.length; i++) {
        if (i > 0) whereClause = sql`${whereClause} AND `;
        whereClause = sql`${whereClause}${conditions[i]}`;
      }
    }

    return this.query(sql`
      SELECT DISTINCT
        f.id,
        f.nom,
        f.description,
        f.source_origine AS "sourceOrigine",
        f."collectiviteResponsableSiren" AS "collectiviteSiren",
        f.statut,
        f."leviersSgpe",
        f."competencesM57",
        f."classificationThematiques"
      FROM schema_commun_v2.fiches_action f
      ${plan ? sql`JOIN schema_commun_v2.liens_plans_fiches lpf ON lpf.fiche_action_id = f.id AND lpf.plan_id = ${plan}` : sql``}
      ${whereClause}
      ORDER BY f.nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);
  }

  async plans(params: { siren?: string; crte?: string; departement?: string; page: number; limit: number }) {
    const { siren, crte, departement, page, limit } = params;

    const conditions: SQL[] = [];
    if (siren) conditions.push(sql`p."collectiviteResponsableSiren" = ${siren}`);
    if (crte) conditions.push(sql`p.id_crte = ${crte}`);
    if (departement) conditions.push(sql`ar.code_departement = ${departement}`);

    let whereClause = sql``;
    if (conditions.length > 0) {
      whereClause = sql`WHERE `;
      for (let i = 0; i < conditions.length; i++) {
        if (i > 0) whereClause = sql`${whereClause} AND `;
        whereClause = sql`${whereClause}${conditions[i]}`;
      }
    }

    return this.query(sql`
      SELECT DISTINCT
        p.id,
        p.nom,
        p.type,
        p.description,
        p."periodeDebut",
        p."periodeFin",
        p."collectiviteResponsableSiren" AS "collectiviteSiren",
        p.source,
        p.id_crte
      FROM schema_commun_v2.plans_transition p
      ${departement ? sql`JOIN schema_commun_v2.liens_plans_communes lpc ON lpc.plan_id = p.id JOIN api_referentiel.communes ar ON ar.code_insee = lpc.insee_com` : sql``}
      ${whereClause}
      ORDER BY p.nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);
  }

  async plan(id: string) {
    const [plan] = await this.query(sql`
      SELECT
        p.id,
        p.nom,
        p.type,
        p.description,
        p."periodeDebut",
        p."periodeFin",
        p.source,
        p.id_crte,
        p."collectiviteResponsableSiren" AS "collectiviteSiren",
        c.lib_crte AS crte_nom,
        c.date_signature AS crte_date_signature
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

  clusters(params: { confidence?: string; type: string; page: number; limit: number }) {
    const { confidence, type, page, limit } = params;
    return this.query(sql`
      SELECT id, confiance, taille, type
      FROM schema_commun_v2.clusters
      WHERE type = ${type}
        ${confidence ? sql`AND confiance = ${confidence}` : sql``}
      ORDER BY taille DESC, id
      LIMIT ${limit} OFFSET ${page * limit}
    `);
  }

  async cluster(id: string) {
    const [cluster] = await this.query(
      sql`SELECT id, confiance, taille, type FROM schema_commun_v2.clusters WHERE id = ${id} LIMIT 1`,
    );
    if (!cluster) return null;
    const projets = await this.query(sql`
      SELECT
        p.id,
        p.nom,
        p.source_origine AS "sourceOrigine",
        p."collectiviteResponsableSiren" AS "collectiviteSiren",
        p.llm_sites->0->>'label' AS "llmSite",
        p.llm_sites->0->>'nom_propre' AS "llmSiteNomPropre"
      FROM schema_commun_v2.clusters_membres cm
      JOIN schema_commun_v2.projets_operationnels p ON p.id = cm.projet_id
      WHERE cm.cluster_id = ${id}
    `);
    const fiches = await this.query(sql`
      SELECT
        f.id,
        f.nom,
        f.source_origine AS "sourceOrigine",
        f."collectiviteResponsableSiren" AS "collectiviteSiren"
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
