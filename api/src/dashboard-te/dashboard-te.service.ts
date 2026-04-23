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

  async statsNational() {
    const [row] = await this.query(sql`
      SELECT
        (SELECT count(*) FROM schema_commun_v2.projets_operationnels) AS projets,
        (SELECT count(*) FROM schema_commun_v2.fiches_action) AS fiches,
        (SELECT count(*) FROM schema_commun_v2.plans_transition) AS plans,
        (SELECT count(*) FROM schema_commun_v2.clusters) AS clusters,
        (SELECT count(*) FROM schema_commun_v2.clusters WHERE confiance='CERTAIN') AS clusters_certain,
        (SELECT count(*) FROM schema_commun_v2.clusters WHERE confiance='PROBABLE') AS clusters_probable
    `);
    return row;
  }

  async collectivites(params: { region?: string; departement?: string; page: number; limit: number }) {
    const { region, departement, page, limit } = params;
    return this.query(sql`
      SELECT siren, nom, type, code_insee, code_epci, code_departements, code_regions
      FROM api_referentiel.communes
      WHERE 1=1
        ${departement ? sql`AND ${departement} = ANY(code_departements)` : sql``}
        ${region ? sql`AND ${region} = ANY(code_regions)` : sql``}
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
      SELECT ar.code_insee, ar.nom, ar.code_departements, ar.code_regions
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
