import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { sql, SQL } from "drizzle-orm";
import {
  CursorPosition,
  decodeCursor,
  encodeCursor,
  LABELS_METHODE,
  ProjetRow,
  SIREN_REGEX,
  toProjetConsultation,
} from "./consultation-projection";
import { ProjetsCollectiviteResponse, ProjetsConsultationResponse } from "./dto/projet-consultation.dto";
import {
  CompletudeSourceDto,
  FinancementsSourceAnneeDto,
  SyntheseCollectiviteResponse,
  ThematiqueIndicateurDto,
} from "./dto/synthese.dto";
import { CollectiviteIndicateursDto, CollectivitesConsultationResponse } from "./dto/collectivites.dto";

type Row = Record<string, unknown>;

export interface ProjetsFilters {
  provenance?: string;
  nature?: string;
  thematique?: string;
  millesime?: number;
}

export interface ProjetsParams extends ProjetsFilters {
  limit: number;
  cursor?: string;
}

export interface CollectivitesParams {
  departement?: string;
  region?: string;
  limit: number;
  cursor?: string;
}

// Financing statuses whose `montant_attribue` is an actual grant (not a request, forecast or refusal).
const STATUTS_ATTRIBUES = ["Obtenu", "Payé"] as const;

// Aligned with territoires / dashboard-te: budgets above this are data errors, kept out of the ratio.
const BUDGET_MAX = 100_000_000;

// Below this share of filled amounts or dates, a source gets a warning in the synthesis.
const SEUIL_COMPLETUDE = 0.9;

const NB_PRINCIPALES_THEMATIQUES = 5;

const UUID_ZERO = "00000000-0000-0000-0000-000000000000";

const DEPARTEMENT_REGEX = /^(\d{2,3}|2[AB])$/;
const REGION_REGEX = /^\d{2,3}$/;

// The consolidated base is built by the ETL, not by our migrations: absent wherever it has not run.
const RELATIONS_REQUISES = [
  "data_projets_consolides.projets",
  "data_projets_consolides.financements",
  "data_projets_consolides.projets_sources",
  "data_projets_consolides.labels_seuil_provisoire_materialise",
];

// Bound text[] (each value as a parameter, never interpolated).
const textArray = (values: readonly string[]): SQL =>
  sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )}]::text[]`;

const LABELS_JOIN = sql`
  LEFT JOIN data_projets_consolides.labels_seuil_provisoire_materialise m
    ON m.projet_id = p.id AND m.methode = ${LABELS_METHODE}`;

// Exact duplicates (same collectivity, same normalised title) share the classified line of
// the labels loader: that line is the grouping key. Nothing is collapsed in base.
const GROUPE = sql`coalesce(m.source_projet_id, p.id)`;

const SOMME_ATTRIBUEE = sql`sum(f.montant_attribue) FILTER (WHERE f.statut = ANY(${textArray(STATUTS_ATTRIBUES)}))`;

const round2 = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class ConsultationService {
  private baseDisponible = false;

  constructor(private readonly dbService: DatabaseService) {}

  private async query<T = Row>(q: SQL): Promise<T[]> {
    const result = await this.dbService.database.execute(q);
    return result.rows as T[];
  }

  /** Bulk read of the whole base, deduplicated at read time, by stable cursor. */
  async projets(params: ProjetsParams): Promise<ProjetsConsultationResponse> {
    await this.assertBaseDisponible();
    const { limit } = params;
    const position: CursorPosition = params.cursor ? decodeCursor(params.cursor) : { siren: "", id: UUID_ZERO };

    let rows: ProjetRow[] = [];
    if (position.siren !== null) {
      // Two steps so that each page only reads the collectivities it serves: the next SIRENs
      // first (index only), then their projects. One extra SIREN covers the one the cursor
      // sits in, which may have nothing left.
      const sirens = await this.nextSirens(position.siren, params, limit + 2);
      if (sirens.length > 0) {
        rows = await this.query<ProjetRow>(
          this.pageQuery(
            sql`p.collectivite_responsable_siren = ANY(${textArray(sirens)})`,
            sql`(g.siren, g.id) > (${position.siren}, ${position.id}::uuid)`,
            params,
            limit + 1,
          ),
        );
      }
    }
    // Projects without a responsible collectivity come last.
    if (rows.length <= limit) {
      const afterId = position.siren === null ? position.id : UUID_ZERO;
      const sansSiren = await this.query<ProjetRow>(
        this.pageQuery(
          sql`p.collectivite_responsable_siren IS NULL`,
          sql`g.id > ${afterId}::uuid`,
          params,
          limit + 1 - rows.length,
        ),
      );
      rows = rows.concat(sansSiren);
    }

    return this.toPage(rows, limit);
  }

  async projetsCollectivite(siren: string, params: ProjetsParams): Promise<ProjetsCollectiviteResponse> {
    this.assertSiren(siren);
    await this.assertBaseDisponible();
    const { limit } = params;
    const afterId = params.cursor ? decodeCursor(params.cursor).id : UUID_ZERO;
    const scope = sql`p.collectivite_responsable_siren = ${siren}`;

    const [rows, [{ total }]] = await Promise.all([
      this.query<ProjetRow>(this.pageQuery(scope, sql`g.id > ${afterId}::uuid`, params, limit + 1)),
      this.query<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM (
          SELECT 1
          FROM data_projets_consolides.projets p ${LABELS_JOIN}
          WHERE ${scope}
          GROUP BY ${GROUPE}
          HAVING bool_or(${this.filterCondition(params)})
        ) groupes`),
    ]);

    return { ...this.toPage(rows, limit), total };
  }

  async synthese(siren: string): Promise<SyntheseCollectiviteResponse> {
    this.assertSiren(siren);
    await this.assertBaseDisponible();

    const [cellules, projets, thematiques, [taux], [collectivite]] = await Promise.all([
      this.query<{
        source: string;
        annee: number | null;
        nb: number;
        nb_montant: number;
        nb_date: number;
        montant: string | null;
      }>(sql`
        SELECT f.source,
               -- a few upstream dates are typos (year 0203): out of range years count as unknown
               CASE WHEN f.date_attribution BETWEEN '1900-01-01' AND '2100-12-31'
                    THEN extract(year FROM f.date_attribution)::int END AS annee,
               count(*)::int AS nb,
               count(f.montant_attribue)::int AS nb_montant,
               count(f.date_attribution)::int AS nb_date,
               ${SOMME_ATTRIBUEE} AS montant
        FROM data_projets_consolides.financements f
        JOIN data_projets_consolides.projets p ON p.id = f.projet_id
        WHERE p.collectivite_responsable_siren = ${siren}
        GROUP BY 1, 2
        ORDER BY 1, 2`),
      this.projetsParCollectivite([siren]),
      this.thematiquesParCollectivite([siren]),
      this.query<{ nb: number; montant: string | null; budget: string | null }>(sql`
        SELECT count(*)::int AS nb, sum(l.montant) AS montant, sum(l.budget) AS budget
        FROM (
          SELECT p.budget_previsionnel AS budget, ${SOMME_ATTRIBUEE} AS montant
          FROM data_projets_consolides.projets p
          JOIN data_projets_consolides.financements f ON f.projet_id = p.id
          WHERE p.collectivite_responsable_siren = ${siren}
            AND p.budget_previsionnel > 0 AND p.budget_previsionnel <= ${BUDGET_MAX}
          GROUP BY p.id, p.budget_previsionnel
        ) l
        WHERE l.montant > 0`),
      this.query<{ nom: string }>(sql`
        SELECT nom FROM api_referentiel.communes WHERE siren = ${siren}
        UNION ALL
        SELECT nom FROM api_referentiel.groupements WHERE siren = ${siren}
        LIMIT 1`),
    ]);

    const financementsParSourceEtAnnee: FinancementsSourceAnneeDto[] = cellules.map((c) => ({
      source: c.source,
      annee: c.annee,
      nbFinancements: c.nb,
      montantAttribue: Number(c.montant ?? 0),
    }));

    const parSource = new Map<string, { nb: number; nbMontant: number; nbDate: number }>();
    for (const c of cellules) {
      const cumul = parSource.get(c.source) ?? { nb: 0, nbMontant: 0, nbDate: 0 };
      cumul.nb += c.nb;
      cumul.nbMontant += c.nb_montant;
      cumul.nbDate += c.nb_date;
      parSource.set(c.source, cumul);
    }
    const completudeParSource: CompletudeSourceDto[] = [...parSource.entries()].map(([source, c]) => ({
      source,
      nbFinancements: c.nb,
      tauxMontantRenseigne: round2(c.nbMontant / c.nb),
      tauxDateRenseignee: round2(c.nbDate / c.nb),
    }));

    const avertissements = completudeParSource
      .filter((c) => c.tauxMontantRenseigne < SEUIL_COMPLETUDE || c.tauxDateRenseignee < SEUIL_COMPLETUDE)
      .map(
        (c) =>
          `${c.source} : montant attribué renseigné sur ${Math.round(c.tauxMontantRenseigne * 100)} % des financements, ` +
          `date d'attribution sur ${Math.round(c.tauxDateRenseignee * 100)} %. Totaux et ventilation par année sous-estimés pour cette source.`,
      );
    avertissements.push(
      "Thématiques issues de labels provisoires (seuil non calibré) : les valeurs peuvent évoluer.",
      "Les montants payés ne sont pas disponibles.",
    );

    const montantComparable = Number(taux.montant ?? 0);
    const budgetComparable = Number(taux.budget ?? 0);
    const compte = projets.get(siren);

    return {
      siren,
      nom: collectivite?.nom ?? null,
      nbProjets: compte?.nbProjets ?? 0,
      nbLignes: compte?.nbLignes ?? 0,
      nbFinancements: financementsParSourceEtAnnee.reduce((n, c) => n + c.nbFinancements, 0),
      montantAttribueTotal: round2(financementsParSourceEtAnnee.reduce((n, c) => n + c.montantAttribue, 0)),
      financementsParSourceEtAnnee,
      completudeParSource,
      parThematique: thematiques.get(siren) ?? [],
      tauxFinancement: {
        nbProjetsComparables: taux.nb,
        montantAttribue: montantComparable,
        budgetPrevisionnel: budgetComparable,
        taux: budgetComparable > 0 ? Math.round((montantComparable / budgetComparable) * 10000) / 10000 : null,
      },
      labels: { provisoire: true, methode: LABELS_METHODE },
      avertissements,
    };
  }

  /** Collectivities of a department or region (from the referential), with comparable indicators. */
  async collectivites(params: CollectivitesParams): Promise<CollectivitesConsultationResponse> {
    const { departement, region, limit, cursor } = params;
    if ((departement === undefined) === (region === undefined)) {
      throw new BadRequestException("Préciser departement ou region (l'un des deux, pas les deux)");
    }
    if (departement !== undefined && !DEPARTEMENT_REGEX.test(departement)) {
      throw new BadRequestException("departement invalide (attendu : code INSEE, ex. 59, 2A, 974)");
    }
    if (region !== undefined && !REGION_REGEX.test(region)) {
      throw new BadRequestException("region invalide (attendu : code INSEE, ex. 32)");
    }
    if (cursor !== undefined && !SIREN_REGEX.test(cursor)) {
      throw new BadRequestException("cursor invalide");
    }
    await this.assertBaseDisponible();

    const dansTerritoire =
      departement !== undefined ? sql`c.code_departement = ${departement}` : sql`c.code_region = ${region}`;

    const liste = await this.query<{ siren: string; nom: string; type: string; population: number | null }>(sql`
      SELECT * FROM (
        SELECT c.siren, c.nom, 'commune' AS type, c.population
        FROM api_referentiel.communes c
        WHERE ${dansTerritoire}
        UNION ALL
        -- a grouping belongs to the territory as soon as one of its member communes does
        SELECT g.siren, g.nom, g.type, g.population
        FROM api_referentiel.groupements g
        WHERE EXISTS (
          SELECT 1 FROM api_referentiel.perimetres pe
          JOIN api_referentiel.communes c ON c.code_insee = pe.code_insee_commune
          WHERE pe.siren_groupement = g.siren AND ${dansTerritoire}
        )
      ) collectivites
      WHERE siren > ${cursor ?? ""}
      ORDER BY siren
      LIMIT ${limit + 1}`);

    const page = liste.slice(0, limit);
    const meta = { limit, labels: { provisoire: true as const, methode: LABELS_METHODE } };
    if (page.length === 0) return { data: [], nextCursor: null, ...meta };
    const sirens = page.map((c) => c.siren);

    const [projets, thematiques, financements] = await Promise.all([
      this.projetsParCollectivite(sirens),
      this.thematiquesParCollectivite(sirens),
      this.financementsParCollectivite(sirens),
    ]);

    const data: CollectiviteIndicateursDto[] = page.map((c) => ({
      siren: c.siren,
      nom: c.nom,
      type: c.type,
      population: c.population,
      nbProjets: projets.get(c.siren)?.nbProjets ?? 0,
      nbFinancements: financements.get(c.siren)?.nbFinancements ?? 0,
      montantAttribueTotal: financements.get(c.siren)?.montantAttribue ?? 0,
      principalesThematiques: (thematiques.get(c.siren) ?? []).slice(0, NB_PRINCIPALES_THEMATIQUES),
    }));

    return { data, nextCursor: liste.length > limit ? sirens[sirens.length - 1] : null, ...meta };
  }

  private assertSiren(siren: string): void {
    if (!SIREN_REGEX.test(siren)) {
      throw new BadRequestException("siren invalide (attendu : 9 chiffres)");
    }
  }

  // 503 rather than a raw 500 where the ETL has not built the base (staging, fresh databases).
  private async assertBaseDisponible(): Promise<void> {
    if (this.baseDisponible) return;
    const [{ present }] = await this.query<{ present: boolean }>(
      sql`SELECT bool_and(to_regclass(r) IS NOT NULL) AS present FROM unnest(${textArray(RELATIONS_REQUISES)}) AS r`,
    );
    if (!present) {
      throw new ServiceUnavailableException("Base consolidée indisponible dans cet environnement");
    }
    this.baseDisponible = true;
  }

  // A deduplicated project matches when one of its lines satisfies every filter.
  private filterCondition(filters: ProjetsFilters): SQL {
    const conditions: SQL[] = [];
    if (filters.provenance) conditions.push(sql`${filters.provenance} = ANY(p.sources)`);
    if (filters.nature) conditions.push(sql`m.nature = ${filters.nature}`);
    if (filters.thematique) {
      conditions.push(sql`m.classification_thematiques @> ${textArray([filters.thematique])}`);
    }
    if (filters.millesime) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM data_projets_consolides.financements f
        WHERE f.projet_id = p.id
          AND f.date_attribution >= make_date(${filters.millesime}, 1, 1)
          AND f.date_attribution < make_date(${filters.millesime + 1}, 1, 1))`);
    }
    return conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`true`;
  }

  private async nextSirens(from: string, filters: ProjetsFilters, count: number): Promise<string[]> {
    const usesLabels = Boolean(filters.nature ?? filters.thematique);
    const rows = await this.query<{ siren: string }>(sql`
      SELECT DISTINCT p.collectivite_responsable_siren AS siren
      FROM data_projets_consolides.projets p ${usesLabels ? LABELS_JOIN : sql``}
      WHERE p.collectivite_responsable_siren >= ${from} AND ${this.filterCondition(filters)}
      ORDER BY 1
      LIMIT ${count}`);
    return rows.map((r) => r.siren);
  }

  /**
   * One page of deduplicated projects within `scope`, after the `after` position.
   * A group is carried by its first line (smallest id); sources and financements are those
   * of all its lines, so no provenance is lost.
   */
  private pageQuery(scope: SQL, after: SQL, filters: ProjetsFilters, limit: number): SQL {
    return sql`
      WITH lignes AS (
        SELECT p.id, p.collectivite_responsable_siren AS siren, ${GROUPE} AS groupe,
               (${this.filterCondition(filters)}) AS correspond
        FROM data_projets_consolides.projets p ${LABELS_JOIN}
        WHERE ${scope}
      ), groupes AS (
        SELECT id, siren,
               row_number() OVER (PARTITION BY siren, groupe ORDER BY id) AS rang,
               array_agg(id) OVER (PARTITION BY siren, groupe) AS membres,
               bool_or(correspond) OVER (PARTITION BY siren, groupe) AS correspond
        FROM lignes
      )
      SELECT
        p.id, p.nom, p.description, p.budget_previsionnel,
        p.date_debut::text AS date_debut, p.date_fin::text AS date_fin,
        p.phase, p.phase_statut,
        p.collectivite_responsable_siren, p.porteur_operationnel_siret, p.porteur_nom,
        p.territoire_communes, p.territoire_departement,
        p.localisation_latitude, p.localisation_longitude, p.localisation_adresse, p.localisation_ban_id,
        p.plan_transition_ids, p.programmes_rattachement, p.ouverture,
        cardinality(g.membres) AS nb_lignes,
        (SELECT json_agg(json_build_object('provenance', ps.source, 'idSource', ps.id_source, 'role', ps.role)
                         ORDER BY ps.source, ps.id_source)
           FROM data_projets_consolides.projets_sources ps
          WHERE ps.projet_id = ANY(g.membres)) AS sources,
        (SELECT json_agg(json_build_object(
                           'source', f.source,
                           'referenceExterne', f.reference_externe,
                           'dateAttribution', f.date_attribution,
                           'montantDemande', f.montant_demande,
                           'montantAttribue', f.montant_attribue,
                           'statut', f.statut)
                         ORDER BY f.date_attribution, f.source, f.id)
           FROM data_projets_consolides.financements f
          WHERE f.projet_id = ANY(g.membres)) AS financements,
        (m.projet_id IS NOT NULL) AS labels_present,
        m.classification_thematiques, m.classification_sites, m.classification_interventions,
        m.leviers, m.competences_m57, m.nature, m.nature_confiance,
        m.te_global, m.te_attenuation, m.te_adaptation, m.te_biodiversite,
        m.bv_attenuation_cotation, m.bv_adaptation_cotation, m.bv_eau_cotation,
        m.bv_circulaire_cotation, m.bv_pollution_cotation, m.bv_biodiversite_cotation
      FROM groupes g
      JOIN data_projets_consolides.projets p ON p.id = g.id
      ${LABELS_JOIN}
      WHERE g.rang = 1 AND g.correspond AND ${after}
      ORDER BY g.siren, g.id
      LIMIT ${limit}`;
  }

  private toPage(rows: ProjetRow[], limit: number): ProjetsConsultationResponse {
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      data: page.map(toProjetConsultation),
      limit,
      nextCursor:
        rows.length > limit ? encodeCursor({ siren: last.collectivite_responsable_siren, id: last.id }) : null,
    };
  }

  private async projetsParCollectivite(
    sirens: string[],
  ): Promise<Map<string, { nbProjets: number; nbLignes: number }>> {
    const rows = await this.query<{ siren: string; nb_projets: number; nb_lignes: number }>(sql`
      SELECT p.collectivite_responsable_siren AS siren,
             count(DISTINCT ${GROUPE})::int AS nb_projets,
             count(*)::int AS nb_lignes
      FROM data_projets_consolides.projets p ${LABELS_JOIN}
      WHERE p.collectivite_responsable_siren = ANY(${textArray(sirens)})
      GROUP BY 1`);
    return new Map(rows.map((r) => [r.siren, { nbProjets: r.nb_projets, nbLignes: r.nb_lignes }]));
  }

  // Per collectivity, thematics by decreasing number of (deduplicated) projects.
  private async thematiquesParCollectivite(sirens: string[]): Promise<Map<string, ThematiqueIndicateurDto[]>> {
    const rows = await this.query<{ siren: string; thematique: string; nb: number; montant: string | null }>(sql`
      WITH lignes AS (
        SELECT p.collectivite_responsable_siren AS siren, ${GROUPE} AS groupe,
               m.classification_thematiques AS thematiques,
               (SELECT ${SOMME_ATTRIBUEE}
                  FROM data_projets_consolides.financements f WHERE f.projet_id = p.id) AS montant
        FROM data_projets_consolides.projets p ${LABELS_JOIN}
        WHERE p.collectivite_responsable_siren = ANY(${textArray(sirens)})
      ), groupes AS (
        -- labels are shared by all the lines of a group
        SELECT siren, groupe, thematiques, sum(montant) AS montant
        FROM lignes
        GROUP BY siren, groupe, thematiques
      )
      SELECT g.siren, t.thematique, count(*)::int AS nb, sum(g.montant) AS montant
      FROM groupes g, unnest(g.thematiques) AS t(thematique)
      GROUP BY 1, 2
      ORDER BY 1, 3 DESC, 2`);

    const result = new Map<string, ThematiqueIndicateurDto[]>();
    for (const r of rows) {
      const liste = result.get(r.siren) ?? [];
      liste.push({ thematique: r.thematique, nbProjets: r.nb, montantAttribue: Number(r.montant ?? 0) });
      result.set(r.siren, liste);
    }
    return result;
  }

  private async financementsParCollectivite(
    sirens: string[],
  ): Promise<Map<string, { nbFinancements: number; montantAttribue: number }>> {
    const rows = await this.query<{ siren: string; nb: number; montant: string | null }>(sql`
      SELECT p.collectivite_responsable_siren AS siren, count(*)::int AS nb, ${SOMME_ATTRIBUEE} AS montant
      FROM data_projets_consolides.financements f
      JOIN data_projets_consolides.projets p ON p.id = f.projet_id
      WHERE p.collectivite_responsable_siren = ANY(${textArray(sirens)})
      GROUP BY 1`);
    return new Map(rows.map((r) => [r.siren, { nbFinancements: r.nb, montantAttribue: Number(r.montant ?? 0) }]));
  }
}
