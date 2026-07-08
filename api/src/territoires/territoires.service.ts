import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { mecExternalIds } from "@database/schema";
import { and, eq, sql, SQL } from "drizzle-orm";
import { activeDecisionPredicate, notTombstonePredicate } from "@/decisions/active-decisions";
import { DECISION_TYPES } from "@/decisions/decision-contract";
import { splitLeviersCsv } from "./leviers-csv";
import {
  TerritoireDecisionDto,
  TerritoireGroupeDto,
  TerritoireProjetsResponse,
  TerritoireTraceDto,
} from "./dto/territoire-projets.dto";
import { PlansTerritoireResponse } from "./dto/plans-territoire.dto";
import { QualificationResponse } from "./dto/qualification.dto";

type Row = Record<string, unknown>;

// Sources dont les traces sont des financements (et non des projets) : elles ne
// suffisent pas, à elles seules, à matérialiser un projet sur le territoire.
const FINANCEMENT_SOURCES = ["DGCL DETR", "DGCL DSIL", "DGCL DPV", "Fonds Vert"] as const;

// Valeurs autorisées des filtres COP (validées → 400 sinon).
const COP_MILLESIMES = ["2024", "2025"] as const;
const COP_STATUTS_VIVIER = ["a_remonter", "a_travailler", "hors_cop_mais_crte", "non_remonte"] as const;

// Code INSEE de commune : 5 chiffres, ou code corse 2A/2B + 3 chiffres.
const CODE_INSEE_REGEX = /^(\d{5}|2[AB]\d{3})$/;
const SIREN_REGEX = /^\d{9}$/;

// Bornes de l'enrichissement decisions[] (journal à l'échelle humaine, mais append-only) :
// - garde-fou global sur la requête (taille du result-set),
// - plafond par groupe sur la réponse exposée (les plus récentes d'abord).
const DECISIONS_QUERY_LIMIT = 2000;
const DECISIONS_PER_GROUP_CAP = 100;

// Aligné sur dashboard-te.service : budget prévisionnel plafonné (les valeurs
// aberrantes deviennent NULL). Le budget est stocké en TEXT dans schema_commun_v2.
const BUDGET_MAX = 100_000_000;

// Cast numérique GARDÉ par une regex : une donnée sale (colonne TEXT réécrite par
// l'ETL) ne fait jamais planter la requête — elle devient NULL. Le cast n'est
// évalué qu'après validation du motif (CASE imbriqué, pas de AND non court-circuité).
const numericGuard = (col: SQL): SQL =>
  sql`(CASE WHEN ${col} ~ '^[0-9]+([.][0-9]+)?$' THEN CAST(${col} AS numeric) END)`;
const cappedBudget = (col: SQL): SQL =>
  sql`(CASE WHEN ${col} ~ '^[0-9]+([.][0-9]+)?$'
       THEN (CASE WHEN CAST(${col} AS numeric) <= ${BUDGET_MAX} THEN CAST(${col} AS numeric) END)
       END)`;

// Tableau text[] bindé (chaque valeur en paramètre, jamais interpolée).
const textArray = (values: string[]): SQL =>
  sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )}]::text[]`;

export interface TerritoireProjetsParams {
  sources?: string[];
  copMillesime?: string;
  copStatutVivier?: string;
  limit: number;
  offset: number;
  inclureFinancementsSeuls: boolean;
  // Exclut les groupes dont une trace est marquée obsolète (décision active
  // projet_statut, verdict 'obsolete'). Défaut false.
  masquerObsoletes: boolean;
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
   * déduplication. `code` = INSEE commune (5 chiffres / 2A|2B + 3) ou SIREN EPCI (9 chiffres).
   */
  async territoireProjets(code: string, params: TerritoireProjetsParams): Promise<TerritoireProjetsResponse> {
    const { sources, copMillesime, copStatutVivier, limit, offset, inclureFinancementsSeuls, masquerObsoletes } =
      params;

    if (copMillesime !== undefined && !COP_MILLESIMES.includes(copMillesime as (typeof COP_MILLESIMES)[number])) {
      throw new BadRequestException(`copMillesime invalide (attendu : ${COP_MILLESIMES.join(", ")})`);
    }
    if (
      copStatutVivier !== undefined &&
      !COP_STATUTS_VIVIER.includes(copStatutVivier as (typeof COP_STATUTS_VIVIER)[number])
    ) {
      throw new BadRequestException(`copStatutVivier invalide (attendu : ${COP_STATUTS_VIVIER.join(", ")})`);
    }

    const communes = await this.resolveCommunes(code);

    // Filtres appliqués aux SEULS projets du territoire (avant expansion en cluster
    // complet — les membres hors territoire du même cluster sont conservés).
    const filterConditions: SQL[] = [];
    if (sources && sources.length > 0) {
      filterConditions.push(sql`p.source_origine = ANY(${textArray(sources)})`);
    }
    if (copMillesime) filterConditions.push(sql`p.cop_millesime = ${copMillesime}`);
    if (copStatutVivier) filterConditions.push(sql`p.cop_statut_vivier = ${copStatutVivier}`);
    let filterWhere: SQL = sql``;
    for (const cond of filterConditions) filterWhere = sql`${filterWhere} AND ${cond}`;

    // Rôle d'une trace : financement si sa source est une source de financement, sinon projet.
    const roleExpr = sql`CASE WHEN p.source_origine = ANY(${textArray([...FINANCEMENT_SOURCES])}) THEN 'financement' ELSE 'projet' END`;

    // Projets actuellement marqués obsolètes : dernière décision projet_statut ACTIVE
    // (non supersédée) de verdict 'obsolete' par projet (la plus récente prime). Table
    // decisions_humaines à l'échelle humaine (faible volume) : toujours calculée, seul
    // le filtre `masquerObsoletes` la consomme — la vue « vivant/mort » ANCT.
    // Chaîne de CTE partagée entre la requête de page et le COUNT de repli.
    const cteBody = sql`
      obsolete_pids AS (
        SELECT s.oid
        FROM (
          SELECT DISTINCT ON (d.objet_a_id) d.objet_a_id AS oid, d.verdict
          FROM decisions_humaines.decisions d
          WHERE d.type_decision = 'projet_statut'
            AND ${activeDecisionPredicate("d")}
            -- Les révocations (verdict='annule') ne participent pas au « plus récent gagne » :
            -- exclues, sinon une révocation d'une décision sans lien masquerait un obsolète actif.
            AND ${notTombstonePredicate("d")}
          -- Départage déterministe des created_at égaux (import/backfill en une
          -- transaction ⇒ now() figé) : id DESC, aligné sur le pipeline.
          ORDER BY d.objet_a_id, d.created_at DESC, d.id DESC
        ) s
        WHERE s.verdict = 'obsolete'
      ),
      territory_pids AS (
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
        SELECT g.group_key, g.cluster_id, cm.projet_id AS pid
        FROM groups g
        JOIN schema_commun_v2.clusters_membres cm ON cm.cluster_id = g.cluster_id
        WHERE g.cluster_id IS NOT NULL
        UNION
        SELECT g.group_key, g.cluster_id, g.group_key AS pid
        FROM groups g
        WHERE g.cluster_id IS NULL
      ),
      member_rows AS (
        SELECT
          gm.group_key,
          gm.cluster_id,
          p.id,
          ${roleExpr} AS role,
          p.source_origine AS source,
          p.nom,
          p."phaseStatut" AS statut,
          p.phase,
          ${cappedBudget(sql`p."budgetPrevisionnel"`)} AS budget,
          -- Subvention attribuée : somme des montants attribués des financements liés au projet.
          -- Sous-requête (et non JOIN) pour éviter de multiplier les traces si plusieurs financements.
          (
            SELECT SUM(${numericGuard(sql`f."montantAttribue"`)})
            FROM schema_commun_v2.liens_financements_projets lfp
            JOIN schema_commun_v2.financements f ON f.id = lfp.financement_id
            WHERE lfp.projet_id = p.id
          ) AS montant_attribue,
          p.cop_millesime,
          p.cop_statut_vivier,
          -- external_id résolu pour les seules traces MEC ; cast ::uuid réservé à ce cas
          -- (certains ids — cop_*, dgcl-* — ne sont pas des UUID).
          CASE WHEN p.source_origine = 'MEC' THEN (
            SELECT ext.external_id FROM data_mec.external_ids ext
            WHERE ext.service_type = 'MEC' AND ext.objet_id = p.id::uuid
            LIMIT 1
          ) END AS external_id,
          -- La trace porte-t-elle une décision projet_statut active 'obsolete' ?
          EXISTS (SELECT 1 FROM obsolete_pids op WHERE op.oid = p.id) AS is_obsolete
        FROM group_members gm
        JOIN schema_commun_v2.projets_operationnels p ON p.id = gm.pid
      ),
      group_agg AS (
        SELECT
          mr.group_key,
          MAX(mr.cluster_id) AS cluster_id,
          MIN(mr.id) AS min_id,
          bool_and(mr.role = 'financement') AS all_financement,
          bool_or(mr.is_obsolete) AS has_obsolete,
          jsonb_agg(
            jsonb_build_object(
              'role', mr.role,
              'source', mr.source,
              'id', mr.id,
              'nom', mr.nom,
              'statut', mr.statut,
              'phase', mr.phase,
              'budgetPrevisionnel', mr.budget,
              'montantAttribue', mr.montant_attribue,
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
        SELECT ga.min_id, ga.all_financement, ga.has_obsolete, ga.traces, c.confiance
        FROM group_agg ga
        LEFT JOIN schema_commun_v2.clusters c ON c.id = ga.cluster_id
      ),
      filtered_groups AS (
        SELECT confiance, traces, min_id
        FROM group_final
        WHERE ${inclureFinancementsSeuls ? sql`TRUE` : sql`all_financement = FALSE`}
          ${masquerObsoletes ? sql`AND has_obsolete = FALSE` : sql``}
      )
    `;

    const rows = await this.query<{ confiance: string | null; traces: unknown; total: string }>(sql`
      WITH ${cteBody}
      SELECT confiance, traces, count(*) OVER() AS total
      FROM filtered_groups
      ORDER BY min_id
      LIMIT ${limit} OFFSET ${offset}
    `);

    let total = rows.length > 0 ? Number(rows[0].total) : 0;
    // Page vide au-delà du 1er offset : count(*) OVER() ne renvoie aucune ligne,
    // donc aucun total. On le récupère par un COUNT dédié pour ne pas mentir avec 0.
    if (rows.length === 0 && offset > 0) {
      const [countRow] = await this.query<{ total: string }>(sql`
        WITH ${cteBody}
        SELECT count(*)::text AS total FROM filtered_groups
      `);
      total = Number(countRow?.total ?? 0);
    }

    const groupes: TerritoireGroupeDto[] = rows.map((r) => ({
      confiance: (r.confiance as TerritoireGroupeDto["confiance"]) ?? null,
      traces: (r.traces as TerritoireTraceDto[]) ?? [],
      decisions: [],
    }));

    await this.attachActiveDecisions(groupes);

    return { total, limit, offset, groupes };
  }

  /**
   * Enrichit chaque groupe de la page avec ses décisions humaines ACTIVES, en UNE seule
   * requête pour toute la page (pas de N+1 ; jointure sur les index objet_a/b_id). Une
   * décision est rattachée au groupe dès que son objet A OU son objet B est l'une des
   * traces du groupe. Toutes plateformes confondues (vue référentiel partagée), mais
   * l'agent auteur n'est JAMAIS exposé (PII + cloisonnement inter-plateformes).
   */
  private async attachActiveDecisions(groupes: TerritoireGroupeDto[]): Promise<void> {
    // Un id de trace appartient à un seul groupe (un projet est dans un seul cluster).
    const groupByTraceId = new Map<string, TerritoireGroupeDto>();
    for (const g of groupes) {
      for (const t of g.traces) {
        if (t.id != null) groupByTraceId.set(t.id, g);
      }
    }
    const ids = [...groupByTraceId.keys()];
    if (ids.length === 0) return;

    const rows = await this.query<{
      type: string;
      verdict: string | null;
      plateforme: string;
      createdAt: Date | string;
      objetAId: string;
      objetBId: string | null;
      commentaire: string | null;
    }>(sql`
      SELECT
        d.type_decision AS type,
        d.verdict,
        d.plateforme_source AS plateforme,
        d.created_at AS "createdAt",
        d.objet_a_id AS "objetAId",
        d.objet_b_id AS "objetBId",
        d.commentaire
      FROM decisions_humaines.decisions d
      WHERE (d.objet_a_id = ANY(${textArray(ids)}) OR d.objet_b_id = ANY(${textArray(ids)}))
        AND d.type_decision = ANY(${textArray([...DECISION_TYPES])})
        AND ${activeDecisionPredicate("d")}
        -- Pierres tombales (verdict='annule') exclues : elles ne font que révoquer leur cible.
        AND ${notTombstonePredicate("d")}
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT ${DECISIONS_QUERY_LIMIT}
    `);

    for (const r of rows) {
      const decision: TerritoireDecisionDto = {
        type: r.type,
        verdict: r.verdict,
        plateforme: r.plateforme,
        createdAt: this.toIso(r.createdAt)!,
        objetAId: r.objetAId,
        objetBId: r.objetBId,
        commentaire: r.commentaire,
      };
      // Une décision de doublon touche deux traces (A↔B) potentiellement dans deux
      // groupes distincts : l'attacher à chacun, une seule fois par groupe, dans la
      // limite du plafond par groupe (les plus récentes d'abord, déjà triées).
      const touched = new Set<TerritoireGroupeDto>();
      const groupA = groupByTraceId.get(r.objetAId);
      const groupB = r.objetBId != null ? groupByTraceId.get(r.objetBId) : undefined;
      if (groupA) touched.add(groupA);
      if (groupB) touched.add(groupB);
      for (const g of touched) {
        if (g.decisions.length < DECISIONS_PER_GROUP_CAP) g.decisions.push(decision);
      }
    }
  }

  /**
   * PCAET couvrant les communes d'un projet MEC (résolu via son external_id).
   * S'appuie sur schema_commun_v2.pcaet_reference (table créée par le chantier T4).
   */
  async planFichesTerritoire(externalId: string): Promise<PlansTerritoireResponse> {
    const projetId = await this.resolveMecProjetId(externalId);
    await this.assertProjetInSchemaCommun(projetId);

    const communeRows = await this.query<{ insee: string }>(sql`
      SELECT insee_com AS insee
      FROM schema_commun_v2.liens_projets_communes
      WHERE projet_id = ${projetId}
    `);
    const communes = communeRows.map((r) => r.insee);
    if (communes.length === 0) {
      return { pcaet: [], fichesActionSuggerees: [] };
    }

    // pcaet_reference est produite par un chantier distinct (T4) et peut ne pas encore
    // exister en production : on dégrade en liste vide plutôt que de renvoyer un 500
    // "relation does not exist". Une fois la table créée, l'endpoint sert les données
    // sans changement de code. (Même esprit que la garde IF EXISTS de la migration.)
    if (!(await this.pcaetReferenceExists())) {
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

    // Rattachements décidés par la plateforme (décision active la plus récente projet ↔ PCAET).
    const rattachements =
      pcaetRows.length > 0 ? await this.rattachementsByPcaet(projetId) : new Map<string, "confirme" | "infirme">();

    return {
      pcaet: pcaetRows.map((r) => ({
        nom: r.nom,
        sirenPorteur: r.sirenPorteur,
        presentDansTet: r.presentDansTet,
        tetExternalId: r.tetExternalId ?? null,
        source: r.source,
        rattachement: (r.sirenPorteur != null ? rattachements.get(r.sirenPorteur) : undefined) ?? "aucun",
      })),
      // TODO(T4+): dériver des fiches action suggérées depuis les PCAET rattachés (bonus hors scope immédiat).
      fichesActionSuggerees: [],
    };
  }

  /**
   * Verdict de rattachement PCAET par SIREN porteur pour un projet : dernière décision
   * rattachement_pcaet ACTIVE (non supersédée) par PCAET (la plus récente prime en cas
   * de décisions actives contradictoires). Seuls les verdicts confirme/infirme sont retenus.
   */
  private async rattachementsByPcaet(projetId: string): Promise<Map<string, "confirme" | "infirme">> {
    const rows = await this.query<{ siren: string; verdict: string | null }>(sql`
      SELECT DISTINCT ON (d.objet_b_id) d.objet_b_id AS siren, d.verdict
      FROM decisions_humaines.decisions d
      WHERE d.type_decision = 'rattachement_pcaet'
        AND d.objet_a_id = ${projetId}
        AND d.objet_b_type = 'pcaet'
        AND ${activeDecisionPredicate("d")}
        -- Révocations (verdict='annule') exclues : une décision annulée ne rattache rien.
        AND ${notTombstonePredicate("d")}
      -- id DESC départage les created_at égaux (cf. obsolete_pids), aligné sur le pipeline.
      ORDER BY d.objet_b_id, d.created_at DESC, d.id DESC
    `);
    const map = new Map<string, "confirme" | "infirme">();
    for (const r of rows) {
      if (r.verdict === "confirme" || r.verdict === "infirme") map.set(r.siren, r.verdict);
    }
    return map;
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

    // external_id orphelin : résout vers un objet absent de schema_commun_v2
    // (non synchronisé). 404 explicite plutôt qu'un 200 vide indiscernable.
    if (!row) {
      throw new NotFoundException(this.orphanMessage(projetId));
    }

    return {
      externalId,
      projetId,
      leviersSgpe: splitLeviersCsv(row.leviersSgpe ?? null),
      llmThematiques: row.llmThematiques ?? null,
      llmProbabiliteTe: row.llmProbabiliteTe != null ? Number(row.llmProbabiliteTe) : null,
      llmClassifiedAt: this.toIso(row.llmClassifiedAt ?? null),
    };
  }

  // Résout le code territoire en liste de communes INSEE.
  // 5 chiffres (ou 2A/2B + 3) → commune ; 9 chiffres → communes membres de l'EPCI.
  // 404 si commune ou EPCI inconnu du référentiel ; autre format → 404.
  private async resolveCommunes(code: string): Promise<string[]> {
    // Normalise la casse pour les codes corses (2A/2B stockés en majuscules).
    const normalized = code.toUpperCase();
    if (CODE_INSEE_REGEX.test(normalized)) {
      const rows = await this.query<{ ok: number }>(sql`
        SELECT 1 AS ok FROM api_referentiel.communes WHERE code_insee = ${normalized} LIMIT 1
      `);
      if (rows.length === 0) {
        throw new NotFoundException(`Commune inconnue au référentiel : ${normalized}`);
      }
      return [normalized];
    }
    if (SIREN_REGEX.test(normalized)) {
      const rows = await this.query<{ insee: string }>(sql`
        SELECT code_insee_commune AS insee
        FROM api_referentiel.perimetres
        WHERE siren_groupement = ${normalized}
      `);
      if (rows.length === 0) {
        throw new NotFoundException(`Aucune commune trouvée pour le territoire ${normalized}`);
      }
      return rows.map((r) => r.insee);
    }
    throw new NotFoundException(
      `Code territoire invalide : ${code} (attendu : INSEE commune 5 chiffres / 2A|2B+3, ou SIREN EPCI 9 chiffres)`,
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

  // ~1 053 external_ids MEC pointent vers un objet absent de schema_commun_v2
  // (non synchronisé). On matérialise ce cas par un 404 explicite.
  private async assertProjetInSchemaCommun(projetId: string): Promise<void> {
    const rows = await this.query<{ ok: number }>(sql`
      SELECT 1 AS ok FROM schema_commun_v2.projets_operationnels WHERE id = ${projetId} LIMIT 1
    `);
    if (rows.length === 0) {
      throw new NotFoundException(this.orphanMessage(projetId));
    }
  }

  // La table de référence PCAET est un livrable du chantier T4, déployé indépendamment.
  // to_regclass renvoie NULL si la relation n'existe pas (lookup catalogue, sans erreur).
  private async pcaetReferenceExists(): Promise<boolean> {
    const [row] = await this.query<{ present: boolean }>(
      sql`SELECT to_regclass('schema_commun_v2.pcaet_reference') IS NOT NULL AS present`,
    );
    return row?.present === true;
  }

  private orphanMessage(projetId: string): string {
    return `Projet ${projetId} hors du schéma commun — non synchronisé.`;
  }

  private toIso(value: Date | string | null): string | null {
    if (value == null) return null;
    return value instanceof Date ? value.toISOString() : value;
  }
}
