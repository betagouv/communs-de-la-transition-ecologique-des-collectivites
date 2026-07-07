import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { mecExternalIds } from "@database/schema";
import { and, eq, sql, SQL } from "drizzle-orm";
import { splitLeviersCsv } from "./leviers-csv";
import { TerritoireGroupeDto, TerritoireProjetsResponse, TerritoireTraceDto } from "./dto/territoire-projets.dto";
import { PlansTerritoireResponse } from "./dto/plans-territoire.dto";
import { QualificationResponse } from "./dto/qualification.dto";

type Row = Record<string, unknown>;

// Sources dont les traces sont des financements (et non des projets) : elles ne
// suffisent pas, à elles seules, à matérialiser un projet sur le territoire.
const FINANCEMENT_SOURCES = ["DGCL DETR", "DGCL DSIL", "DGCL DPV", "Fonds Vert"] as const;

// Aligné sur dashboard-te.service : budget prévisionnel plafonné (les valeurs
// aberrantes deviennent NULL). Le budget est stocké en TEXT dans schema_commun_v2.
const BUDGET_MAX = 100_000_000;
const cappedBudget = (col: SQL): SQL =>
  sql`(CASE WHEN CAST(NULLIF(${col}, '') AS numeric) <= ${BUDGET_MAX} THEN CAST(NULLIF(${col}, '') AS numeric) END)`;

// Tableau text[] bindé (chaque valeur en paramètre, jamais interpolée).
const textArray = (values: string[]): SQL =>
  sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )}]::text[]`;

export interface TerritoireProjetsParams {
  sources?: string[];
  copMillesime?: string;
  statut?: string;
  limit: number;
  offset: number;
  inclureFinancementsSeuls: boolean;
}

@Injectable()
export class TerritoiresService {
  constructor(private readonly dbService: DatabaseService) {}

  private async query<T = Row>(q: ReturnType<typeof sql>): Promise<T[]> {
    const result = await this.dbService.database.execute(q);
    return result.rows as T[];
  }

  /**
   * Projets de transition écologique d'un territoire, regroupés par cluster de
   * déduplication. `code` = INSEE commune (5 chiffres) ou SIREN EPCI (9 chiffres).
   */
  async territoireProjets(code: string, params: TerritoireProjetsParams): Promise<TerritoireProjetsResponse> {
    const { sources, copMillesime, statut, limit, offset, inclureFinancementsSeuls } = params;
    const communes = await this.resolveCommunes(code);

    // Filtres appliqués aux SEULS projets du territoire (avant expansion en cluster
    // complet — les membres hors territoire du même cluster sont conservés).
    const filterConditions: SQL[] = [];
    if (sources && sources.length > 0) {
      filterConditions.push(sql`p.source_origine = ANY(${textArray(sources)})`);
    }
    if (copMillesime) filterConditions.push(sql`p.cop_millesime = ${copMillesime}`);
    if (statut) filterConditions.push(sql`p.cop_statut_vivier = ${statut}`);
    let filterWhere: SQL = sql``;
    for (const cond of filterConditions) filterWhere = sql`${filterWhere} AND ${cond}`;

    // Rôle d'une trace : financement si sa source est une source de financement, sinon projet.
    const roleExpr = sql`CASE WHEN p.source_origine = ANY(${textArray([...FINANCEMENT_SOURCES])}) THEN 'financement' ELSE 'projet' END`;

    const rows = await this.query<{ confiance: string | null; traces: unknown; total: string }>(sql`
      WITH territory_pids AS (
        SELECT DISTINCT lpc.projet_id AS pid
        FROM schema_commun_v2.liens_projets_communes lpc
        WHERE lpc.insee_com = ANY(${textArray(communes)})
      ),
      filtered_pids AS (
        SELECT tp.pid
        FROM territory_pids tp
        JOIN schema_commun_v2.projets_operationnels p ON p.id = tp.pid
        WHERE 1 = 1 ${filterWhere}
      ),
      -- group_key = cluster_id si le projet appartient à un cluster, sinon son propre id (singleton).
      projet_group AS (
        SELECT fp.pid,
          COALESCE(cm.cluster_id, fp.pid) AS group_key,
          cm.cluster_id AS cluster_id
        FROM filtered_pids fp
        LEFT JOIN schema_commun_v2.clusters_membres cm ON cm.projet_id = fp.pid
      ),
      groups AS (
        SELECT group_key, MAX(cluster_id) AS cluster_id
        FROM projet_group
        GROUP BY group_key
      ),
      -- Tous les membres du groupe : membres du cluster (même hors territoire) OU le singleton lui-même.
      group_members AS (
        SELECT g.group_key, cm.projet_id AS pid
        FROM groups g
        JOIN schema_commun_v2.clusters_membres cm ON cm.cluster_id = g.cluster_id
        WHERE g.cluster_id IS NOT NULL
        UNION
        SELECT g.group_key, g.group_key AS pid
        FROM groups g
        WHERE g.cluster_id IS NULL
      ),
      member_rows AS (
        SELECT
          gm.group_key,
          p.id,
          ${roleExpr} AS role,
          p.source_origine AS source,
          p.nom,
          p."phaseStatut" AS statut,
          p.phase,
          ${cappedBudget(sql`p."budgetPrevisionnel"`)} AS budget,
          p.cop_millesime,
          p.cop_statut_vivier,
          -- external_id résolu pour les seules traces MEC ; cast ::uuid réservé à ce cas
          -- (certains ids — cop_*, dgcl-* — ne sont pas des UUID).
          CASE WHEN p.source_origine = 'MEC' THEN (
            SELECT ext.external_id FROM data_mec.external_ids ext
            WHERE ext.service_type = 'MEC' AND ext.objet_id = p.id::uuid
            LIMIT 1
          ) END AS external_id
        FROM group_members gm
        JOIN schema_commun_v2.projets_operationnels p ON p.id = gm.pid
      ),
      group_agg AS (
        SELECT
          mr.group_key,
          MIN(mr.id) AS min_id,
          bool_and(mr.role = 'financement') AS all_financement,
          jsonb_agg(
            jsonb_build_object(
              'role', mr.role,
              'source', mr.source,
              'id', mr.id,
              'nom', mr.nom,
              'statut', mr.statut,
              'phase', mr.phase,
              'budgetPrevisionnel', mr.budget,
              'copMillesime', mr.cop_millesime,
              'copStatutVivier', mr.cop_statut_vivier,
              'externalId', mr.external_id
            )
            ORDER BY mr.id
          ) AS traces
        FROM member_rows mr
        GROUP BY mr.group_key
      ),
      group_final AS (
        SELECT ga.min_id, ga.all_financement, ga.traces, c.confiance
        FROM group_agg ga
        LEFT JOIN schema_commun_v2.clusters c ON c.id = ga.group_key
      )
      SELECT confiance, traces, count(*) OVER() AS total
      FROM group_final
      WHERE ${inclureFinancementsSeuls ? sql`TRUE` : sql`all_financement = FALSE`}
      ORDER BY min_id
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    const groupes: TerritoireGroupeDto[] = rows.map((r) => ({
      confiance: (r.confiance as TerritoireGroupeDto["confiance"]) ?? null,
      traces: (r.traces as TerritoireTraceDto[]) ?? [],
    }));

    return { total, limit, offset, groupes };
  }

  /**
   * PCAET couvrant les communes d'un projet MEC (résolu via son external_id).
   * S'appuie sur schema_commun_v2.pcaet_reference (table créée par le chantier T4).
   */
  async planFichesTerritoire(externalId: string): Promise<PlansTerritoireResponse> {
    const projetId = await this.resolveMecProjetId(externalId);

    const communeRows = await this.query<{ insee: string }>(sql`
      SELECT insee_com AS insee
      FROM schema_commun_v2.liens_projets_communes
      WHERE projet_id = ${projetId}
    `);
    const communes = communeRows.map((r) => r.insee);
    if (communes.length === 0) {
      return { pcaet: [], fichesActionSuggerees: [] };
    }

    const pcaetRows = await this.query<{
      nom: string | null;
      sirenPorteur: string | null;
      presentDansTet: boolean;
      tetExternalId: string | null;
      source: string | null;
    }>(sql`
      SELECT
        pr.nom,
        pr.siren_porteur AS "sirenPorteur",
        (pr.tet_external_id IS NOT NULL) AS "presentDansTet",
        pr.tet_external_id AS "tetExternalId",
        pr.source_nom AS source
      FROM schema_commun_v2.pcaet_reference pr
      WHERE pr.communes && ${textArray(communes)}
      ORDER BY pr.nom
    `);

    return {
      pcaet: pcaetRows.map((r) => ({
        nom: r.nom,
        sirenPorteur: r.sirenPorteur,
        presentDansTet: r.presentDansTet,
        tetExternalId: r.tetExternalId ?? null,
        source: r.source,
      })),
      // TODO(T4+): dériver des fiches action suggérées depuis les PCAET rattachés (bonus hors scope immédiat).
      fichesActionSuggerees: [],
    };
  }

  /**
   * Qualification LLM d'un projet MEC (résolu via son external_id) :
   * leviers SGPE, thématiques LLM, probabilité TE et date de classification.
   */
  async qualification(externalId: string): Promise<QualificationResponse> {
    const projetId = await this.resolveMecProjetId(externalId);

    const [row] = await this.query<{
      leviersSgpe: string | null;
      llmThematiques: unknown;
      llmProbabiliteTe: number | string | null;
      llmClassifiedAt: Date | string | null;
    }>(sql`
      SELECT
        "leviersSgpe" AS "leviersSgpe",
        llm_thematiques AS "llmThematiques",
        llm_probabilite_te AS "llmProbabiliteTe",
        llm_classified_at AS "llmClassifiedAt"
      FROM schema_commun_v2.projets_operationnels
      WHERE id = ${projetId}
      LIMIT 1
    `);

    return {
      externalId,
      projetId,
      leviersSgpe: splitLeviersCsv(row?.leviersSgpe ?? null),
      llmThematiques: row?.llmThematiques ?? null,
      llmProbabiliteTe: row?.llmProbabiliteTe != null ? Number(row.llmProbabiliteTe) : null,
      llmClassifiedAt: this.toIso(row?.llmClassifiedAt ?? null),
    };
  }

  // Résout le code territoire en liste de communes INSEE.
  // 5 chiffres → commune telle quelle ; 9 chiffres → communes membres de l'EPCI
  // (404 si aucune) ; autre → 404 (format invalide).
  private async resolveCommunes(code: string): Promise<string[]> {
    if (/^\d{5}$/.test(code)) return [code];
    if (/^\d{9}$/.test(code)) {
      const rows = await this.query<{ insee: string }>(sql`
        SELECT code_insee_commune AS insee
        FROM api_referentiel.perimetres
        WHERE siren_groupement = ${code}
      `);
      if (rows.length === 0) {
        throw new NotFoundException(`Aucune commune trouvée pour le territoire ${code}`);
      }
      return rows.map((r) => r.insee);
    }
    throw new NotFoundException(
      `Code territoire invalide : ${code} (attendu : INSEE commune 5 chiffres ou SIREN EPCI 9 chiffres)`,
    );
  }

  // Résout un external_id MEC en id de projet stable (data_mec.external_ids). 404 si inconnu.
  private async resolveMecProjetId(externalId: string): Promise<string> {
    const [row] = await this.dbService.database
      .select({ objetId: mecExternalIds.objetId })
      .from(mecExternalIds)
      .where(and(eq(mecExternalIds.serviceType, "MEC"), eq(mecExternalIds.externalId, externalId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Projet MEC inconnu pour l'external_id ${externalId}`);
    }
    return row.objetId;
  }

  private toIso(value: Date | string | null): string | null {
    if (value == null) return null;
    return value instanceof Date ? value.toISOString() : value;
  }
}
