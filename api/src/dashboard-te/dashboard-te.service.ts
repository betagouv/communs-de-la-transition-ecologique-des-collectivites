import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { sql, SQL } from "drizzle-orm";

// Dashboard TE API — raw SQL queries against schema_commun_v2 + snapshot_crte + api_referentiel.
// Called by the dashboard-te Cloudflare Worker (static SPA proxy) via API key.

type Row = Record<string, unknown>;

// Returns the JSONB value when it is genuinely an array, else '[]'.
// jsonb_array_elements raises on a scalar/object, which would crash the query.
const jsonbArray = (col: SQL): SQL =>
  sql`(CASE WHEN jsonb_typeof((${col})::jsonb) = 'array' THEN (${col})::jsonb ELSE '[]'::jsonb END)`;

// Aggregates the `label` of every element of a JSONB classification array
// (llm_thematiques / llm_sites / llm_interventions) into a real JSON array.
// Replaces the comma-joined-string representation, which is ambiguous for labels
// that themselves contain commas (e.g. the theme "Voie douce, piste cyclable" is
// a single label, indistinguishable from two labels once CSV-flattened).
const classifLabels = (col: SQL): SQL =>
  sql`(SELECT COALESCE(jsonb_agg(elem->>'label'), '[]'::jsonb)
       FROM jsonb_array_elements(${jsonbArray(col)}) AS elem
       WHERE elem->>'label' IS NOT NULL)`;

// Plafond au-delà duquel le budget prévisionnel d'un projet est jugé aberrant
// (saisie erronée) : il est alors écarté — nullifié dans les réponses projet et
// exclu des sommes de budget des stats. Le projet lui-même reste compté/listé.
const BUDGET_MAX = 100_000_000;

// Budget prévisionnel plafonné : la valeur numérique si <= BUDGET_MAX, sinon NULL
// (les SUM ignorent NULL, les réponses renvoient null).
const cappedBudget = (col: SQL): SQL =>
  sql`(CASE WHEN CAST(NULLIF(${col}, '') AS numeric) <= ${BUDGET_MAX} THEN CAST(NULLIF(${col}, '') AS numeric) END)`;

// Token-exact match against a comma-separated text column (competencesM57,
// leviersSgpe). Wrapping the column value in commas turns substring matching into
// whole-token matching, so "90-51" no longer matches "90-512". Multiple values
// are OR'd; each value is bound as a parameter (no interpolation).
const csvTokenClause = (col: SQL, values: string[]): SQL | null => {
  const tokens = values.map((v) => v.trim()).filter(Boolean);
  if (tokens.length === 0) return null;
  const parts = tokens.map((v) => sql`(',' || ${col} || ',') ILIKE ${`%,${v},%`}`);
  return sql`(${sql.join(parts, sql` OR `)})`;
};

// Filtres communs aux endpoints /projets et /projets/summary.
export interface ProjetsFilter {
  commune?: string;
  departement?: string;
  siren?: string;
  // EPCI (SIREN de groupement) : développé en ses communes membres via
  // api_referentiel.perimetres pour agréger tous les projets du territoire.
  epci?: string;
  levier?: string[];
  competence?: string[];
  match?: "all" | "any";
  site?: { label: string; scoreMin?: number }[];
  intervention?: { label: string; scoreMin?: number }[];
  thematique?: { label: string; scoreMin?: number }[];
  scoreMin?: number;
  source?: string;
  phase?: string;
  financement?: "avec" | "sans";
  montantMin?: number;
  montantMax?: number;
  probaTeMin?: number;
  probaTeMax?: number;
  q?: string;
  // false (défaut) : exclut les projets DGCL (source_origine LIKE 'DGCL%'),
  // non synchronisés / non qualifiés / non dédoublonnés. true : les inclut.
  inclureDgcl?: boolean;
}

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
  // Source allégée pour les stats nationales : une ligne par projet — et, si
  // inclureTet, par fiche action TeT racine — avec les seules colonnes agrégées.
  private statsActions(inclureTet: boolean): SQL {
    const projets = sql`
      SELECT
        source_origine AS "sourceOrigine",
        phase,
        ${cappedBudget(sql`"budgetPrevisionnel"`)} AS budget,
        "competencesM57" AS competences,
        "leviersSgpe" AS leviers,
        "collectiviteResponsableSiren" AS siren
      FROM schema_commun_v2.projets_operationnels`;
    if (!inclureTet) return projets;
    const fiches = sql`
      SELECT
        'TeT'::text AS "sourceOrigine",
        f.source_metadata->>'phase' AS phase,
        ${cappedBudget(sql`f.source_metadata->>'budgetPrevisionnel'`)} AS budget,
        array_to_string(f.competences_m57, ',') AS competences,
        array_to_string(f.leviers_sgpe, ',') AS leviers,
        f.collectivite_responsable_siren AS siren
      FROM data_tet.fiches_action f
      WHERE f.parent_id IS NULL`;
    return sql`${projets} UNION ALL ${fiches}`;
  }

  async statsNational(inclureTet = false) {
    const actions = this.statsActions(inclureTet);

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
      WITH a AS (${actions})
      SELECT
        (SELECT count(*) FROM a)::text AS "totalProjets",
        (SELECT COALESCE(SUM(budget), 0) FROM a)::text AS "totalBudget",
        (SELECT count(DISTINCT siren) FROM a WHERE siren IS NOT NULL)::text AS "totalCollectivites",
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
      WITH a AS (${actions})
      SELECT "sourceOrigine" AS source, count(*)::text AS count,
        COALESCE(SUM(budget), 0)::text AS budget
      FROM a
      WHERE "sourceOrigine" IS NOT NULL
      GROUP BY "sourceOrigine"
      ORDER BY count(*) DESC
    `);

    // By phase
    const parPhase = await this.query<{ phase: string; count: string; budget: string }>(sql`
      WITH a AS (${actions})
      SELECT COALESCE(NULLIF(phase, ''), 'Non renseigné') AS phase,
        count(*)::text AS count,
        COALESCE(SUM(budget), 0)::text AS budget
      FROM a
      GROUP BY 1
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
      WITH action_dept AS (
        SELECT DISTINCT p.id::text AS id, p."collectiviteResponsableSiren" AS siren,
          ${cappedBudget(sql`p."budgetPrevisionnel"`)} AS budget,
          ar.code_departement AS dept, ar.code_region AS reg
        FROM schema_commun_v2.projets_operationnels p
        JOIN schema_commun_v2.liens_projets_communes lpc ON lpc.projet_id = p.id
        JOIN api_referentiel.communes ar ON ar.code_insee = lpc.insee_com
        WHERE ar.code_departement IS NOT NULL
        ${
          inclureTet
            ? sql`
        UNION ALL
        SELECT DISTINCT f.id::text, f.collectivite_responsable_siren,
          ${cappedBudget(sql`f.source_metadata->>'budgetPrevisionnel'`)},
          ar.code_departement, ar.code_region
        FROM data_tet.fiches_action f
        JOIN api_referentiel.communes ar ON ar.code_insee = ANY(f.territoire_communes)
        WHERE f.parent_id IS NULL AND ar.code_departement IS NOT NULL`
            : sql``
        }
      )
      SELECT dept AS code,
        dept AS nom,
        COALESCE(MAX(reg), '') AS region,
        count(DISTINCT id)::text AS "nbProjets",
        count(DISTINCT siren)::text AS "nbCollectivites",
        COALESCE(SUM(budget), 0)::text AS "budgetTotal",
        0::text AS "nbPlans"
      FROM action_dept
      GROUP BY dept
      ORDER BY dept
    `);

    // Top leviers SGPE
    const parLevier = await this.query<{ levier: string; count: string }>(sql`
      WITH a AS (${actions})
      SELECT levier, count(*)::text AS count
      FROM a, UNNEST(string_to_array(leviers, ',')) AS levier
      WHERE levier IS NOT NULL AND trim(levier) <> ''
      GROUP BY levier
      ORDER BY count(*) DESC
      LIMIT 20
    `);

    // Top competences M57
    const parCompetence = await this.query<{ code: string; count: string }>(sql`
      WITH a AS (${actions})
      SELECT code, count(*)::text AS count
      FROM a, UNNEST(string_to_array(competences, ',')) AS code
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
        (SELECT COALESCE(SUM(${cappedBudget(sql`"budgetPrevisionnel"`)}), 0) FROM projet_dept)::text AS "budgetTotal"
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

  /**
   * Distribution of a JSONB classification column (first element's label) across all projects,
   * keeping only entries whose score >= scoreMin (default 0.8). Used to feed front-end dropdowns
   * with values actually present in the data.
   */
  async statsClassif(
    column: "llm_sites" | "llm_thematiques" | "llm_interventions",
    scoreMin?: number,
  ): Promise<{ value: string; count: number }[]> {
    const threshold = scoreMin ?? 0.8;
    const col = (() => {
      switch (column) {
        case "llm_sites":
          return sql`p.llm_sites`;
        case "llm_thematiques":
          return sql`p.llm_thematiques`;
        case "llm_interventions":
          return sql`p.llm_interventions`;
      }
    })();
    const rows = await this.query<{ value: string; count: string }>(sql`
      SELECT
        ${col}->0->>'label' AS value,
        count(*)::text AS count
      FROM schema_commun_v2.projets_operationnels p
      WHERE ${col}->0->>'label' IS NOT NULL
        AND COALESCE((${col}->0->>'score')::numeric, 0) >= ${threshold}
      GROUP BY 1
      ORDER BY count(*) DESC, value
    `);
    return rows.map((r) => ({ value: r.value, count: Number(r.count) }));
  }

  async collectivites(params: { region?: string; departement?: string; q?: string; page: number; limit: number }) {
    const { region, departement, q, page, limit } = params;
    const pattern = q ? `%${q}%` : null;
    const whereSuffix = sql`
      WHERE 1=1
        ${departement ? sql`AND code_departement = ${departement}` : sql``}
        ${region ? sql`AND code_region = ${region}` : sql``}
        ${pattern ? sql`AND nom ILIKE ${pattern}` : sql``}`;
    const items = await this.query(sql`
      SELECT siren, nom, 'Commune' AS type, code_insee, code_epci,
        code_departement AS "codeDepartement", code_region AS "codeRegion",
        population
      FROM api_referentiel.communes
      ${whereSuffix}
      ORDER BY nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);
    const [{ total }] = await this.query<{ total: string }>(sql`
      SELECT count(*)::text AS total FROM api_referentiel.communes ${whereSuffix}
    `);
    return { items, total: Number(total) };
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

  // Builds the FROM/JOIN and WHERE clauses shared by /projets and
  // /projets/summary, so both endpoints accept exactly the same filters.
  private buildProjetsFilter(f: ProjetsFilter): { joinClause: SQL; whereClause: SQL } {
    const scoreMin = f.scoreMin ?? 0.8;
    const pattern = f.q ? `%${f.q}%` : null;

    // Builds `(label=X1 AND score>=S1) OR (label=X2 AND score>=S2) ...`
    // where Sn falls back to the request-level scoreMin if not set per-entry.
    const classifClause = (col: SQL, entries: { label: string; scoreMin?: number }[]): SQL => {
      const parts = entries.map(
        (e) =>
          sql`(${col}->0->>'label' = ${e.label} AND COALESCE((${col}->0->>'score')::numeric, 0) >= ${e.scoreMin ?? scoreMin})`,
      );
      return sql`(${sql.join(parts, sql` OR `)})`;
    };

    const conditions: SQL[] = [];
    // Les projets DGCL (data.gouv) sont exclus par défaut : non synchronisés,
    // non qualifiés, non dédoublonnés. inclure_dgcl=true les réintègre.
    if (!f.inclureDgcl) {
      conditions.push(sql`(p.source_origine IS NULL OR p.source_origine NOT LIKE 'DGCL%')`);
    }
    if (f.commune) conditions.push(sql`lpc.insee_com = ${f.commune}`);
    if (f.departement) conditions.push(sql`ar.code_departement = ${f.departement}`);
    if (f.siren) conditions.push(sql`p."collectiviteResponsableSiren" = ${f.siren}`);
    // EPCI : projets rattachés à une commune membre du groupement.
    if (f.epci)
      conditions.push(
        sql`lpc.insee_com IN (SELECT code_insee_commune FROM api_referentiel.perimetres WHERE siren_groupement = ${f.epci})`,
      );
    if (f.source) conditions.push(sql`p.source_origine = ${f.source}`);
    if (f.phase) conditions.push(sql`p.phase = ${f.phase}`);
    if (pattern) conditions.push(sql`p.nom ILIKE ${pattern}`);

    // Label-axis predicates (competence, levier, site, intervention, thematique).
    // Within an axis, multiple values are always OR'd. Across axes, they are joined
    // with AND when match=all (a project must carry every selected label) or OR when
    // match=any (≥ 1 label is enough). Non-label filters above always stay AND'd.
    const labelPredicates: SQL[] = [];
    if (f.competence && f.competence.length > 0) {
      const pred = csvTokenClause(sql`p."competencesM57"`, f.competence);
      if (pred) labelPredicates.push(pred);
    }
    if (f.levier && f.levier.length > 0) {
      const pred = csvTokenClause(sql`p."leviersSgpe"`, f.levier);
      if (pred) labelPredicates.push(pred);
    }
    if (f.site && f.site.length > 0) labelPredicates.push(classifClause(sql`p.llm_sites`, f.site));
    if (f.intervention && f.intervention.length > 0) {
      labelPredicates.push(classifClause(sql`p.llm_interventions`, f.intervention));
    }
    if (f.thematique && f.thematique.length > 0) {
      labelPredicates.push(classifClause(sql`p.llm_thematiques`, f.thematique));
    }
    if (labelPredicates.length > 0) {
      const joiner = f.match === "all" ? sql` AND ` : sql` OR `;
      conditions.push(sql`(${sql.join(labelPredicates, joiner)})`);
    }

    // Financement filters. financements n'a pas de FK vers le projet : le lien
    // passe par la table de jointure liens_financements_projets(projet_id,
    // financement_id).
    if (f.financement === "avec" || f.financement === "sans") {
      const aFinancement = sql`EXISTS (
        SELECT 1 FROM schema_commun_v2.liens_financements_projets lfp
        WHERE lfp.projet_id = p.id
      )`;
      conditions.push(f.financement === "avec" ? aFinancement : sql`NOT ${aFinancement}`);
    }
    // montantMin/Max : filtre sur le budget prévisionnel du projet (et non sur les
    // financements). Budget plafonné — un budget aberrant (> BUDGET_MAX) devient
    // NULL et ne matche alors aucun intervalle.
    if (f.montantMin !== undefined) {
      conditions.push(sql`${cappedBudget(sql`p."budgetPrevisionnel"`)} >= ${f.montantMin}`);
    }
    if (f.montantMax !== undefined) {
      conditions.push(sql`${cappedBudget(sql`p."budgetPrevisionnel"`)} <= ${f.montantMax}`);
    }
    // probaTeMin/Max : filtre sur la probabilité de transition écologique (llm_probabilite_te,
    // double precision sur 0–1). Un projet sans proba (NULL) ne matche aucun intervalle.
    if (f.probaTeMin !== undefined) {
      conditions.push(sql`p.llm_probabilite_te >= ${f.probaTeMin}`);
    }
    if (f.probaTeMax !== undefined) {
      conditions.push(sql`p.llm_probabilite_te <= ${f.probaTeMax}`);
    }

    const needsCommuneJoin = Boolean(f.commune ?? f.departement ?? f.epci);

    let whereClause = sql``;
    if (conditions.length > 0) {
      whereClause = sql`WHERE `;
      for (let i = 0; i < conditions.length; i++) {
        if (i > 0) whereClause = sql`${whereClause} AND `;
        whereClause = sql`${whereClause}${conditions[i]}`;
      }
    }

    const joinClause = sql`
      FROM schema_commun_v2.projets_operationnels p
      ${needsCommuneJoin ? sql`JOIN schema_commun_v2.liens_projets_communes lpc ON lpc.projet_id = p.id` : sql``}
      ${f.departement ? sql`JOIN api_referentiel.communes ar ON ar.code_insee = lpc.insee_com` : sql``}
    `;

    return { joinClause, whereClause };
  }

  // Filtre pour les fiches action TeT (data_tet.fiches_action), parallèle à
  // buildProjetsFilter. Renvoie null si le filtre exclut d'office toutes les fiches.
  private buildFichesFilter(f: ProjetsFilter): { joinClause: SQL; whereClause: SQL } | null {
    // Les fiches data_tet ont toutes la source « TeT » et n'ont aucun financement.
    if (f.source && f.source !== "TeT") return null;
    if (f.financement === "avec") return null;

    const pattern = f.q ? `%${f.q}%` : null;
    const pgArray = (vals: string[]): SQL =>
      sql`ARRAY[${sql.join(
        vals.map((v) => sql`${v}`),
        sql`, `,
      )}]::text[]`;

    // Conditions toujours AND. parent_id IS NULL : seules les fiches racines sont
    // comptées (les sous-actions gonfleraient les totaux).
    const conditions: SQL[] = [sql`f.parent_id IS NULL`];
    if (f.commune) conditions.push(sql`${f.commune} = ANY(f.territoire_communes)`);
    if (f.departement) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM api_referentiel.communes ar
        WHERE ar.code_insee = ANY(f.territoire_communes) AND ar.code_departement = ${f.departement}
      )`);
    }
    if (f.siren) conditions.push(sql`f.collectivite_responsable_siren = ${f.siren}`);
    // EPCI : fiche dont le territoire inclut une commune membre du groupement.
    // (EXISTS + ANY plutôt que && : évite le conflit de type text[] && varchar[].)
    if (f.epci)
      conditions.push(
        sql`EXISTS (SELECT 1 FROM api_referentiel.perimetres pp WHERE pp.siren_groupement = ${f.epci} AND pp.code_insee_commune = ANY(f.territoire_communes))`,
      );
    if (f.phase) conditions.push(sql`f.source_metadata->>'phase' = ${f.phase}`);
    if (pattern) conditions.push(sql`f.nom ILIKE ${pattern}`);

    // Axes de labels — OR dans un axe, AND/OR entre axes selon match. Les fiches
    // stockent leurs classifications en text[] (recouvrement via &&).
    const labelPredicates: SQL[] = [];
    if (f.competence && f.competence.length > 0) {
      labelPredicates.push(sql`f.competences_m57 && ${pgArray(f.competence)}`);
    }
    if (f.levier && f.levier.length > 0) {
      labelPredicates.push(sql`f.leviers_sgpe && ${pgArray(f.levier)}`);
    }
    const overlap = (col: SQL, entries: { label: string }[]): SQL =>
      sql`${col} && ${pgArray(entries.map((e) => e.label))}`;
    if (f.site && f.site.length > 0) labelPredicates.push(overlap(sql`f.classification_sites`, f.site));
    if (f.intervention && f.intervention.length > 0) {
      labelPredicates.push(overlap(sql`f.classification_interventions`, f.intervention));
    }
    if (f.thematique && f.thematique.length > 0) {
      labelPredicates.push(overlap(sql`f.classification_thematiques`, f.thematique));
    }
    if (labelPredicates.length > 0) {
      const joiner = f.match === "all" ? sql` AND ` : sql` OR `;
      conditions.push(sql`(${sql.join(labelPredicates, joiner)})`);
    }

    const budget = cappedBudget(sql`f.source_metadata->>'budgetPrevisionnel'`);
    if (f.montantMin !== undefined) conditions.push(sql`${budget} >= ${f.montantMin}`);
    if (f.montantMax !== undefined) conditions.push(sql`${budget} <= ${f.montantMax}`);
    const proba = sql`CAST(NULLIF(f.probabilite_te, '') AS double precision)`;
    if (f.probaTeMin !== undefined) conditions.push(sql`${proba} >= ${f.probaTeMin}`);
    if (f.probaTeMax !== undefined) conditions.push(sql`${proba} <= ${f.probaTeMax}`);

    let whereClause = sql`WHERE `;
    for (let i = 0; i < conditions.length; i++) {
      if (i > 0) whereClause = sql`${whereClause} AND `;
      whereClause = sql`${whereClause}${conditions[i]}`;
    }
    return { joinClause: sql`FROM data_tet.fiches_action f`, whereClause };
  }

  // Source normalisée « actions » : les projets_operationnels, et — si inclureTet —
  // les fiches action TeT (data_tet) projetées sur la même forme. Discriminant `type`.
  private actionsSource(filter: ProjetsFilter, inclureTet: boolean): SQL {
    const pf = this.buildProjetsFilter(filter);
    const projetBranch = sql`
      SELECT DISTINCT
        'projet'::text AS type,
        p.id::text AS id,
        p.nom,
        p.description,
        p.source_origine AS "sourceOrigine",
        p.phase,
        p."phaseStatut",
        ${cappedBudget(sql`p."budgetPrevisionnel"`)} AS "budgetPrevisionnel",
        p."dateDebut",
        p."dateFin",
        p."collectiviteResponsableSiren" AS "collectiviteSiren",
        p."competencesM57",
        p."leviersSgpe",
        ${classifLabels(sql`p.llm_thematiques`)} AS "classificationThematiques",
        ${classifLabels(sql`p.llm_sites`)} AS "classificationSites",
        ${classifLabels(sql`p.llm_interventions`)} AS "classificationInterventions",
        p.llm_sites->0->>'label' AS "llmSite",
        p.llm_sites->0->>'nom_propre' AS "llmSiteNomPropre",
        p.llm_interventions->0->>'label' AS "llmIntervention",
        p.llm_thematiques->0->>'label' AS "llmThematique",
        p.llm_probabilite_te AS "llmProbabiliteTe"
      ${pf.joinClause}
      ${pf.whereClause}
    `;
    const ff = inclureTet ? this.buildFichesFilter(filter) : null;
    if (!ff) return projetBranch;
    const ficheBranch = sql`
      SELECT
        'fiche'::text AS type,
        f.id::text AS id,
        f.nom,
        f.description,
        'TeT'::text AS "sourceOrigine",
        f.source_metadata->>'phase' AS phase,
        COALESCE(f.source_metadata->>'phaseStatut', f.statut) AS "phaseStatut",
        ${cappedBudget(sql`f.source_metadata->>'budgetPrevisionnel'`)} AS "budgetPrevisionnel",
        f.source_metadata->>'dateDebutPrevisionnelle' AS "dateDebut",
        NULL::text AS "dateFin",
        f.collectivite_responsable_siren AS "collectiviteSiren",
        array_to_string(f.competences_m57, ',') AS "competencesM57",
        array_to_string(f.leviers_sgpe, ',') AS "leviersSgpe",
        to_jsonb(COALESCE(f.classification_thematiques, ARRAY[]::text[])) AS "classificationThematiques",
        to_jsonb(COALESCE(f.classification_sites, ARRAY[]::text[])) AS "classificationSites",
        to_jsonb(COALESCE(f.classification_interventions, ARRAY[]::text[])) AS "classificationInterventions",
        f.classification_sites[1] AS "llmSite",
        NULL::text AS "llmSiteNomPropre",
        f.classification_interventions[1] AS "llmIntervention",
        f.classification_thematiques[1] AS "llmThematique",
        CAST(NULLIF(f.probabilite_te, '') AS double precision) AS "llmProbabiliteTe"
      ${ff.joinClause}
      ${ff.whereClause}
    `;
    return sql`${projetBranch} UNION ALL ${ficheBranch}`;
  }

  async projets(
    params: ProjetsFilter & {
      sort?: string;
      order?: "asc" | "desc";
      page: number;
      limit: number;
      inclureTet?: boolean;
    },
  ) {
    const { sort, order, page, limit } = params;
    const actions = this.actionsSource(params, params.inclureTet ?? false);

    // Whitelisted sort — `sort` ne picke qu'une colonne de sortie fixe (anti-injection).
    // Plusieurs alias pour le tri budget. Tri secondaire sur nom pour une pagination stable.
    const sortColumns: Record<string, SQL> = {
      nom: sql`nom`,
      montant: sql`"budgetPrevisionnel"`,
      budget: sql`"budgetPrevisionnel"`,
      budgetPrevisionnel: sql`"budgetPrevisionnel"`,
      dateDebut: sql`"dateDebut"`,
      dateFin: sql`"dateFin"`,
    };
    const sortColumn = (sort ? sortColumns[sort] : undefined) ?? sortColumns.nom;
    const sortDirection = order === "desc" ? sql`DESC` : sql`ASC`;
    const orderClause = sql`ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, nom ASC`;

    const items = await this.query(sql`
      WITH a AS (${actions})
      SELECT DISTINCT
        a.*,
        COALESCE(cref.nom, gref.nom) AS "collectiviteNom",
        cref.code_departement AS "codeDepartement",
        cm.cluster_id AS "clusterId",
        c.confiance AS "clusterConfiance"
      FROM a
      LEFT JOIN api_referentiel.communes cref ON cref.siren = a."collectiviteSiren"
      LEFT JOIN api_referentiel.groupements gref ON gref.siren = a."collectiviteSiren"
      LEFT JOIN schema_commun_v2.clusters_membres cm ON cm.projet_id::text = a.id
      LEFT JOIN schema_commun_v2.clusters c ON c.id = cm.cluster_id
      ${orderClause}
      LIMIT ${limit} OFFSET ${page * limit}
    `);

    const [{ total }] = await this.query<{ total: string }>(sql`
      WITH a AS (${actions})
      SELECT count(*)::text AS total FROM a
    `);

    return { items, total: Number(total) };
  }

  /**
   * Synthèse agrégée sur l'ensemble des projets correspondant aux mêmes filtres
   * que /projets : totaux, budget/financement, et répartitions (phase, source,
   * thématiques, compétences M57, leviers TE).
   */
  async projetsSummary(filter: ProjetsFilter, inclureTet: boolean) {
    const actions = this.actionsSource(filter, inclureTet);

    // probaTePondere = Σ(probaTE × budget) / Σ(budget), sur les actions ayant À LA
    // FOIS une proba TE et un budget (plafonné) renseignés. NULL si aucune.
    const [totals] = await this.query<{ count: string; sumBudget: string; probaTePondere: string | null }>(sql`
      WITH a AS (${actions})
      SELECT
        count(*)::text AS count,
        COALESCE(SUM("budgetPrevisionnel"), 0)::text AS "sumBudget",
        (SUM("llmProbabiliteTe" * "budgetPrevisionnel")
          / NULLIF(SUM("budgetPrevisionnel") FILTER (WHERE "llmProbabiliteTe" IS NOT NULL), 0))::text AS "probaTePondere"
      FROM a
    `);

    // Financements : seuls les projets en ont (jointure via liens_financements_projets).
    const [fin] = await this.query<{ sumAttribue: string; avecCount: string }>(sql`
      WITH a AS (${actions})
      SELECT
        COALESCE(SUM(CAST(NULLIF(f."montantAttribue", '') AS numeric)), 0)::text AS "sumAttribue",
        count(DISTINCT lfp.projet_id)::text AS "avecCount"
      FROM a
      JOIN schema_commun_v2.liens_financements_projets lfp ON lfp.projet_id::text = a.id
      JOIN schema_commun_v2.financements f ON f.id = lfp.financement_id
    `);

    const parPhase = await this.query<{ key: string; count: string }>(sql`
      WITH a AS (${actions})
      SELECT COALESCE(NULLIF(phase, ''), 'Non renseigné') AS key, count(*)::text AS count
      FROM a GROUP BY 1 ORDER BY count(*) DESC
    `);

    const parSource = await this.query<{ key: string; count: string }>(sql`
      WITH a AS (${actions})
      SELECT COALESCE(NULLIF("sourceOrigine", ''), 'Non renseigné') AS key, count(*)::text AS count
      FROM a GROUP BY 1 ORDER BY count(*) DESC
    `);

    // Répartition par thématique / site / intervention : labels des tableaux JSON
    // normalisés (un projet/fiche peut en porter plusieurs → compté dans chacun). Top 25.
    const parClassif = (col: SQL) =>
      this.query<{ key: string; count: string }>(sql`
        WITH a AS (${actions})
        SELECT elem AS key, count(*)::text AS count
        FROM a, jsonb_array_elements_text(${jsonbArray(col)}) AS elem
        WHERE elem IS NOT NULL AND elem <> ''
        GROUP BY 1 ORDER BY count(*) DESC, key
        LIMIT 25
      `);
    const parThematique = await parClassif(sql`a."classificationThematiques"`);
    const parSite = await parClassif(sql`a."classificationSites"`);
    const parIntervention = await parClassif(sql`a."classificationInterventions"`);

    // Répartition par compétence M57 / levier TE : colonnes CSV éclatées. Top 25.
    const parCompetence = await this.query<{ key: string; count: string }>(sql`
      WITH a AS (${actions})
      SELECT trim(code) AS key, count(*)::text AS count
      FROM a, UNNEST(string_to_array(a."competencesM57", ',')) AS code
      WHERE trim(code) <> ''
      GROUP BY 1 ORDER BY count(*) DESC, key
      LIMIT 25
    `);

    const parLevier = await this.query<{ key: string; count: string }>(sql`
      WITH a AS (${actions})
      SELECT trim(levier) AS key, count(*)::text AS count
      FROM a, UNNEST(string_to_array(a."leviersSgpe", ',')) AS levier
      WHERE trim(levier) <> ''
      GROUP BY 1 ORDER BY count(*) DESC, key
      LIMIT 25
    `);

    // Répartition par tranche de proba TE : élevée ≥ 0.8, moyenne 0.5–0.8,
    // faible < 0.5, plus les actions sans proba.
    const parTrancheProbaTe = await this.query<{ key: string; count: string }>(sql`
      WITH a AS (${actions})
      SELECT
        CASE
          WHEN "llmProbabiliteTe" IS NULL THEN 'nonRenseigne'
          WHEN "llmProbabiliteTe" >= 0.8 THEN 'elevee'
          WHEN "llmProbabiliteTe" >= 0.5 THEN 'moyenne'
          ELSE 'faible'
        END AS key,
        count(*)::text AS count
      FROM a
      GROUP BY 1
    `);

    // Répartition par millésime (année de début / fin). Les dates sont
    // stockées en texte ISO (YYYY-..., parfois avec heure) et souvent absentes
    // (≈22 % début, ≈12 % fin, nulles sur ACV/PVD) : on n'extrait l'année que
    // des valeurs au format année valide ; le frontend déduit la couverture
    // en comparant la somme des compteurs au total des projets filtrés.
    const parAnnee = (col: SQL) =>
      this.query<{ key: string; count: string }>(sql`
        WITH a AS (${actions})
        SELECT substring(${col} FROM 1 FOR 4) AS key, count(*)::text AS count
        FROM a
        WHERE ${col} IS NOT NULL AND substring(${col} FROM 1 FOR 4) ~ '^[12][0-9]{3}$'
        GROUP BY 1 ORDER BY key
      `);
    const parAnneeDebut = await parAnnee(sql`a."dateDebut"`);
    const parAnneeFin = await parAnnee(sql`a."dateFin"`);

    const toMap = (rows: { key: string; count: string }[]): Record<string, number> =>
      Object.fromEntries(rows.map((r) => [r.key, Number(r.count)]));

    return {
      count: Number(totals?.count ?? 0),
      sumBudgetPrevisionnel: Number(totals?.sumBudget ?? 0),
      sumFinancementAttribue: Number(fin?.sumAttribue ?? 0),
      avecFinancementCount: Number(fin?.avecCount ?? 0),
      probaTeMoyennePonderee: totals?.probaTePondere != null ? Number(totals.probaTePondere) : null,
      parPhase: toMap(parPhase),
      parSource: toMap(parSource),
      parThematique: toMap(parThematique),
      parSite: toMap(parSite),
      parIntervention: toMap(parIntervention),
      parCompetence: toMap(parCompetence),
      parLevier: toMap(parLevier),
      parTrancheProbaTe: { elevee: 0, moyenne: 0, faible: 0, nonRenseigne: 0, ...toMap(parTrancheProbaTe) },
      // Millésimes (année → nombre de projets). Ne contient que les projets
      // dont la date est renseignée et au format année valide.
      parAnneeDebut: toMap(parAnneeDebut),
      parAnneeFin: toMap(parAnneeFin),
    };
  }

  /**
   * Full project detail with financements, cluster, linked plans, and collectivite.
   */
  async projet(id: string, inclureTet = false) {
    const [projet] = await this.query(sql`
      SELECT
        p.id,
        p.nom,
        p.description,
        p.source_origine AS "sourceOrigine",
        p.phase,
        p."phaseStatut",
        ${cappedBudget(sql`p."budgetPrevisionnel"`)} AS "budgetPrevisionnel",
        p."dateDebut",
        p."dateFin",
        p."localisationAdresse" AS adresse,
        p."localisationLatitude" AS latitude,
        p."localisationLongitude" AS longitude,
        p."collectiviteResponsableSiren" AS "collectiviteSiren",
        p."competencesM57",
        p."leviersSgpe",
        ${classifLabels(sql`p.llm_thematiques`)} AS "classificationThematiques",
        ${classifLabels(sql`p.llm_sites`)} AS "classificationSites",
        ${classifLabels(sql`p.llm_interventions`)} AS "classificationInterventions",
        p.llm_sites->0->>'label' AS "llmSite",
        p.llm_sites->0->>'nom_propre' AS "llmSiteNomPropre",
        p.llm_interventions->0->>'label' AS "llmIntervention",
        p.llm_thematiques->0->>'label' AS "llmThematique",
        p.llm_probabilite_te AS "llmProbabiliteTe",
        -- Communes (INSEE) du projet : union des liens explicites et du champ
        -- territoireCommunes (CSV). Sert au moteur d'aides par lieu+labels
        -- (POST /aides/recherche) pour les projets hors registre natif.
        (
          SELECT array_agg(DISTINCT cc) FROM (
            SELECT unnest(
              COALESCE((SELECT array_agg(l.insee_com) FROM schema_commun_v2.liens_projets_communes l WHERE l.projet_id = p.id), ARRAY[]::text[])
              || COALESCE(string_to_array(NULLIF(p."territoireCommunes", ''), ','), ARRAY[]::text[])
            ) AS cc
          ) s WHERE cc <> ''
        ) AS "communesInsee",
        cm.cluster_id AS "clusterId",
        c.confiance AS "clusterConfiance"
      FROM schema_commun_v2.projets_operationnels p
      LEFT JOIN schema_commun_v2.clusters_membres cm ON cm.projet_id = p.id
      LEFT JOIN schema_commun_v2.clusters c ON c.id = cm.cluster_id
      WHERE p.id = ${id}
      LIMIT 1
    `);
    if (!projet) return inclureTet ? this.projetTet(id) : null;

    const financements = await this.query(sql`
      SELECT f.id, f.source,
        CAST(NULLIF(f."montantDemande", '') AS numeric) AS "montantDemande",
        CAST(NULLIF(f."montantAttribue", '') AS numeric) AS "montantAttribue",
        CAST(NULLIF(f."montantPaye", '') AS numeric) AS "montantPaye",
        f.statut
      FROM schema_commun_v2.financements f
      JOIN schema_commun_v2.liens_financements_projets lfp ON lfp.financement_id = f.id
      WHERE lfp.projet_id = ${id}
    `);

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
      type: "projet",
      ...projet,
      financements,
      collectivite: collectivite ?? null,
      linkedPlans,
    };
  }

  /**
   * Détail d'une fiche action TeT (data_tet) — fallback de projet() quand l'id
   * n'est pas un projet opérationnel et que inclure_tet est actif.
   */
  private async projetTet(id: string) {
    const [fiche] = await this.query(sql`
      SELECT
        f.id::text AS id,
        f.nom,
        f.description,
        f.objectifs,
        'TeT' AS "sourceOrigine",
        f.source_metadata->>'phase' AS phase,
        COALESCE(f.source_metadata->>'phaseStatut', f.statut) AS "phaseStatut",
        f.statut,
        ${cappedBudget(sql`f.source_metadata->>'budgetPrevisionnel'`)} AS "budgetPrevisionnel",
        f.source_metadata->>'dateDebutPrevisionnelle' AS "dateDebut",
        f.collectivite_responsable_siren AS "collectiviteSiren",
        f.territoire_communes AS "territoireCommunes",
        array_to_string(f.competences_m57, ',') AS "competencesM57",
        array_to_string(f.leviers_sgpe, ',') AS "leviersSgpe",
        to_jsonb(COALESCE(f.classification_thematiques, ARRAY[]::text[])) AS "classificationThematiques",
        to_jsonb(COALESCE(f.classification_sites, ARRAY[]::text[])) AS "classificationSites",
        to_jsonb(COALESCE(f.classification_interventions, ARRAY[]::text[])) AS "classificationInterventions",
        f.classification_sites[1] AS "llmSite",
        f.classification_interventions[1] AS "llmIntervention",
        f.classification_thematiques[1] AS "llmThematique",
        CAST(NULLIF(f.probabilite_te, '') AS double precision) AS "llmProbabiliteTe",
        f.classification_scores AS "classificationScores"
      FROM data_tet.fiches_action f
      WHERE f.id::text = ${id}
      LIMIT 1
    `);
    if (!fiche) return null;

    const ficheSiren = (fiche as { collectiviteSiren?: string }).collectiviteSiren;
    const [collectivite] = ficheSiren
      ? await this.query(sql`
        SELECT siren, nom, code_departement AS "codeDepartement", code_region AS "codeRegion", population
        FROM api_referentiel.communes
        WHERE siren = ${ficheSiren}
        LIMIT 1
      `)
      : [null];

    const linkedPlans = await this.query(sql`
      SELECT pl.id, pl.nom, pl.type
      FROM data_tet.fiches_action_to_plans fap
      JOIN data_tet.plans_transition pl ON pl.id = fap.plan_transition_id
      WHERE fap.fiche_action_id::text = ${id}
      LIMIT 10
    `);

    return {
      type: "fiche",
      ...fiche,
      financements: [],
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

    const joinClause = sql`
      FROM schema_commun_v2.fiches_action f
      ${plan ? sql`JOIN schema_commun_v2.liens_plans_fiches lpf ON lpf.fiche_action_id = f.id AND lpf.plan_id = ${plan}` : sql``}
    `;
    const items = await this.query(sql`
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
      ${joinClause}
      ${whereClause}
      ORDER BY f.nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);
    const [{ total }] = await this.query<{ total: string }>(sql`
      SELECT count(DISTINCT f.id)::text AS total ${joinClause} ${whereClause}
    `);
    return { items, total: Number(total) };
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

    const joinClause = sql`
      FROM schema_commun_v2.plans_transition p
      ${departement ? sql`JOIN schema_commun_v2.liens_plans_communes lpc ON lpc.plan_id = p.id JOIN api_referentiel.communes ar ON ar.code_insee = lpc.insee_com` : sql``}
    `;
    const items = await this.query(sql`
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
      ${joinClause}
      ${whereClause}
      ORDER BY p.nom
      LIMIT ${limit} OFFSET ${page * limit}
    `);
    const [{ total }] = await this.query<{ total: string }>(sql`
      SELECT count(DISTINCT p.id)::text AS total ${joinClause} ${whereClause}
    `);
    return { items, total: Number(total) };
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
      SELECT ar.siren, ar.nom, ar.type AS nature_juridique
      FROM schema_commun_v2.liens_plans_groupements lpg
      JOIN api_referentiel.groupements ar ON ar.siren = lpg.siren_groupement
      WHERE lpg.plan_id = ${id}
      ORDER BY ar.nom
    `);
  }

  async clusters(params: { confidence?: string; type: string; page: number; limit: number }) {
    const { confidence, type, page, limit } = params;
    const whereClause = sql`
      WHERE type = ${type}
        ${confidence ? sql`AND confiance = ${confidence}` : sql``}`;
    const items = await this.query(sql`
      SELECT id, confiance, taille, type
      FROM schema_commun_v2.clusters
      ${whereClause}
      ORDER BY taille DESC, id
      LIMIT ${limit} OFFSET ${page * limit}
    `);
    const [{ total }] = await this.query<{ total: string }>(sql`
      SELECT count(*)::text AS total FROM schema_commun_v2.clusters ${whereClause}
    `);
    return { items, total: Number(total) };
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

  async dispositifs(filters: { type?: string; statut?: string }) {
    const conditions: SQL[] = [];
    if (filters.type) conditions.push(sql`dt.dispositif = ${filters.type}`);
    if (filters.statut) conditions.push(sql`dt.statut = ${filters.statut}`);
    const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    return this.query(sql`
      SELECT
        dt.epci_siren AS "epciSiren",
        COALESCE(g.nom, dt.metadata->>'epci_nom', '') AS "epciNom",
        dt.dispositif,
        dt.date_signature AS "dateSignature",
        COALESCE(dt.statut, '') AS statut,
        dt.crte_code AS "crteCode",
        dt.metadata->>'crte_nom' AS "crteNom",
        dt.metadata->>'region' AS region
      FROM schema_commun_v2.dispositifs_territoriaux dt
      LEFT JOIN api_referentiel.groupements g ON g.siren = dt.epci_siren
      ${where}
      ORDER BY dt.dispositif, dt.epci_siren
    `);
  }

  async dispositifsAll() {
    const dispositifs = await this.dispositifs({});

    // Stats per type
    const byType = new Map<string, typeof dispositifs>();
    for (const d of dispositifs) {
      const t = d.dispositif as string;
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(d);
    }

    const stats: Record<string, unknown> = {};
    for (const [type, items] of byType) {
      const epciSirens = items.map((i) => (i as Record<string, unknown>).epciSiren as string);
      const parStatut: Record<string, number> = {};
      for (const i of items) {
        const s = (i as Record<string, unknown>).statut as string;
        parStatut[s] = (parStatut[s] ?? 0) + 1;
      }

      // Count from data_mec with CRTE breakdown
      const [counts] = await this.query<{ nb_crte: string; nb_all: string }>(sql`
        SELECT
          COUNT(DISTINCT p.id) FILTER (WHERE p.crte_id IS NOT NULL) AS nb_crte,
          COUNT(DISTINCT p.id) AS nb_all
        FROM data_mec.projets_operationnels p
        JOIN api_referentiel.communes c ON c.code_insee = ANY(p.territoire_communes)
        WHERE c.code_epci = ANY(${sql`ARRAY[${sql.join(
          epciSirens.map((s) => sql`${s}`),
          sql`, `,
        )}]`})
      `);

      stats[type] = {
        totalEpci: items.length,
        nbProjetsCrte: Number(counts?.nb_crte ?? 0),
        nbProjetsMec: Number(counts?.nb_all ?? 0),
        parStatut,
      };
    }

    return { dispositifs, stats };
  }

  async dispositifsProjets(filters: { type?: string; statut?: string; source?: string; page: number; limit: number }) {
    const typeFilter = filters.type ?? "COT";
    const conditions: SQL[] = [sql`p.crte_id IS NOT NULL`, sql`dt.dispositif = ${typeFilter}`];
    if (filters.statut) conditions.push(sql`dt.statut = ${filters.statut}`);
    // source filter ignored — data_mec is MEC-only
    const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    const [countRow] = await this.query<{ total: string }>(sql`
      SELECT COUNT(DISTINCT p.id)::text AS total
      FROM data_mec.projets_operationnels p
      JOIN api_referentiel.communes c ON c.code_insee = ANY(p.territoire_communes)
      JOIN schema_commun_v2.dispositifs_territoriaux dt ON dt.epci_siren = c.code_epci
      ${where}
    `);

    const items = await this.query(sql`
      SELECT DISTINCT ON (p.id)
        p.id,
        p.nom,
        p.description,
        'MEC' AS "sourceOrigine",
        p.phase,
        p.phase_statut AS "phaseStatut",
        p.budget_previsionnel AS "budgetPrevisionnel",
        p.collectivite_responsable_siren AS "collectiviteSiren",
        p.date_debut AS "dateDebut",
        p.date_fin AS "dateFin",
        p.classification_scores->'thematiques' AS "llmThematiques",
        p.classification_scores->'sites' AS "llmSites",
        p.classification_scores->'interventions' AS "llmInterventions",
        p.probabilite_te AS "llmProbabiliteTe",
        p.competences_m57 AS "competencesM57",
        p.leviers_sgpe AS "leviersSgpe",
        p.mots_cles AS "motsCles",
        p.crte_id AS "crteId",
        p.crte_annee_inscription AS "crteAnneeInscription",
        p.crte_orientation_strategique AS "crteOrientationStrategique",
        c.code_epci AS "epciSiren",
        dt.crte_code AS "crteCode",
        dt.metadata->>'crte_nom' AS "crteNom",
        dt.statut AS "cotStatut",
        dt.date_signature AS "cotDateSignature"
      FROM data_mec.projets_operationnels p
      JOIN api_referentiel.communes c ON c.code_insee = ANY(p.territoire_communes)
      JOIN schema_commun_v2.dispositifs_territoriaux dt ON dt.epci_siren = c.code_epci
      ${where}
      ORDER BY p.id
      OFFSET ${filters.page * filters.limit}
      LIMIT ${filters.limit}
    `);

    return { items, total: Number(countRow?.total ?? 0) };
  }
}
