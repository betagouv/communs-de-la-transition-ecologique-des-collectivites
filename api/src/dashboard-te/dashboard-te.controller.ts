import { Controller, Get, NotFoundException, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { DashboardTeService } from "./dashboard-te.service";

const toInt = (v: string | undefined, def: number) => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
};

// Normalizes a query param to a list of values. Multiplicity comes ONLY from
// repeated params (`?x=a&x=b`), never from comma-splitting: classification labels
// (e.g. the theme "Voie douce, piste cyclable") and leviers can contain commas, so
// a comma is not a safe separator. A single occurrence arrives as a string and is
// kept whole.
const toList = (v: string | string[] | undefined): string[] | undefined => {
  if (v == null) return undefined;
  const arr = (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean);
  return arr.length > 0 ? arr : undefined;
};

const parseScoreMin = (v: string | undefined): number | undefined => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// Parses `label` or `label:score` (score = optional per-entry threshold).
// Split on the last `:` only, and only treat the suffix as a score if it parses as a finite number;
// otherwise the entire token is kept as the label (robust to labels containing `:`).
const toClassifList = (v: string | string[] | undefined): { label: string; scoreMin?: number }[] | undefined => {
  const raw = toList(v);
  if (!raw) return undefined;
  return raw.map((item) => {
    const idx = item.lastIndexOf(":");
    if (idx < 0) return { label: item };
    const labelPart = item.slice(0, idx).trim();
    const scorePart = item.slice(idx + 1).trim();
    const score = Number(scorePart);
    if (!labelPart || !Number.isFinite(score)) return { label: item };
    return { label: labelPart, scoreMin: score };
  });
};

type RawQuery = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

// Parses the project filters shared by /projets and /projets/summary so both
// endpoints accept exactly the same filter params.
const parseProjetsFilter = (raw: RawQuery) => {
  const montantMinNum = first(raw.montantMin) ? Number(first(raw.montantMin)) : undefined;
  const montantMaxNum = first(raw.montantMax) ? Number(first(raw.montantMax)) : undefined;
  const probaTeMinNum = first(raw.probaTeMin) ? Number(first(raw.probaTeMin)) : undefined;
  const probaTeMaxNum = first(raw.probaTeMax) ? Number(first(raw.probaTeMax)) : undefined;
  const financementRaw = first(raw.financement);
  const financement: "avec" | "sans" | undefined =
    financementRaw === "avec" || financementRaw === "sans" ? financementRaw : undefined;
  return {
    commune: first(raw.commune),
    departement: first(raw.departement),
    siren: first(raw.siren),
    levier: toList(raw.levier),
    competence: toList(raw.competence),
    match: first(raw.match) === "all" ? ("all" as const) : ("any" as const),
    site: toClassifList(raw.site),
    intervention: toClassifList(raw.intervention),
    thematique: toClassifList(raw.thematique),
    scoreMin: parseScoreMin(first(raw.scoreMin)),
    source: first(raw.source),
    phase: first(raw.phase),
    financement,
    montantMin: Number.isFinite(montantMinNum) && montantMinNum! >= 0 ? montantMinNum : undefined,
    montantMax: Number.isFinite(montantMaxNum) && montantMaxNum! >= 0 ? montantMaxNum : undefined,
    probaTeMin: Number.isFinite(probaTeMinNum) ? probaTeMinNum : undefined,
    probaTeMax: Number.isFinite(probaTeMaxNum) ? probaTeMaxNum : undefined,
    q: first(raw.q),
    inclureDgcl: first(raw.inclure_dgcl) === "true",
  };
};

@ApiTags("Dashboard TE")
@Controller("dashboard-te")
@UseGuards(ApiKeyGuard)
export class DashboardTeController {
  constructor(private readonly svc: DashboardTeService) {}

  @Get("stats/national")
  statsNational(@Query() query: RawQuery) {
    return this.svc.statsNational(first(query.inclure_tet) === "true");
  }

  @Get("stats/departement/:code")
  statsDepartement(@Param("code") code: string) {
    return this.svc.statsDepartement(code);
  }

  @Get("stats/sites")
  async statsSites(@Query("scoreMin") scoreMin?: string) {
    const items = await this.svc.statsClassif("llm_sites", parseScoreMin(scoreMin));
    return { items };
  }

  @Get("stats/thematiques")
  async statsThematiques(@Query("scoreMin") scoreMin?: string) {
    const items = await this.svc.statsClassif("llm_thematiques", parseScoreMin(scoreMin));
    return { items };
  }

  @Get("stats/interventions")
  async statsInterventions(@Query("scoreMin") scoreMin?: string) {
    const items = await this.svc.statsClassif("llm_interventions", parseScoreMin(scoreMin));
    return { items };
  }

  @Get("collectivites")
  async collectivites(
    @Query("region") region?: string,
    @Query("departement") departement?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const p = toInt(page, 0);
    const l = Math.min(toInt(limit, 50), 200);
    const result = await this.svc.collectivites({ region, departement, q, page: p, limit: l });
    return { ...result, page: p, limit: l };
  }

  @Get("collectivites/:siren")
  collectivite(@Param("siren") siren: string) {
    return this.svc.collectivite(siren);
  }

  @Get("projets")
  async projets(@Query() query: RawQuery) {
    const p = toInt(first(query.page), 0);
    const l = Math.min(toInt(first(query.limit), 50), 200);
    const result = await this.svc.projets({
      ...parseProjetsFilter(query),
      sort: first(query.sort) ?? first(query.orderBy),
      order: first(query.order) === "desc" ? "desc" : "asc",
      inclureTet: first(query.inclure_tet) === "true",
      page: p,
      limit: l,
    });
    return { ...result, page: p, limit: l };
  }

  // Déclaré avant projets/:id pour que "summary" ne soit pas capté comme un id.
  @Get("projets/summary")
  async projetsSummary(@Query() query: RawQuery) {
    return this.svc.projetsSummary(parseProjetsFilter(query), first(query.inclure_tet) === "true");
  }

  @Get("projets/:id")
  async projet(@Param("id") id: string, @Query() query: RawQuery) {
    const projet = await this.svc.projet(id, first(query.inclure_tet) === "true");
    if (!projet) throw new NotFoundException("projet not found");
    return projet;
  }

  @Get("fiches")
  async fiches(
    @Query("plan") plan?: string,
    @Query("commune") commune?: string,
    @Query("siren") siren?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const p = toInt(page, 0);
    const l = Math.min(toInt(limit, 50), 200);
    const result = await this.svc.fiches({ plan, commune, siren, q, page: p, limit: l });
    return { ...result, page: p, limit: l };
  }

  @Get("plans")
  async plans(
    @Query("siren") siren?: string,
    @Query("crte") crte?: string,
    @Query("departement") departement?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const p = toInt(page, 0);
    const l = Math.min(toInt(limit, 50), 200);
    const result = await this.svc.plans({ siren, crte, departement, page: p, limit: l });
    return { ...result, page: p, limit: l };
  }

  @Get("plans/:id")
  async plan(@Param("id") id: string) {
    const plan = await this.svc.plan(id);
    if (!plan) throw new NotFoundException("plan not found");
    return plan;
  }

  @Get("plans/:id/communes")
  async planCommunes(@Param("id") id: string) {
    const items = await this.svc.planCommunes(id);
    return { items };
  }

  @Get("plans/:id/groupements")
  async planGroupements(@Param("id") id: string) {
    const items = await this.svc.planGroupements(id);
    return { items };
  }

  @Get("clusters")
  async clusters(
    @Query("confidence") confidence?: string,
    @Query("type") type?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const p = toInt(page, 0);
    const l = Math.min(toInt(limit, 50), 200);
    const result = await this.svc.clusters({
      confidence,
      type: type === "affinity" ? "affinity" : "duplicate",
      page: p,
      limit: l,
    });
    return { ...result, page: p, limit: l };
  }

  @Get("clusters/:id")
  async cluster(@Param("id") id: string) {
    const cluster = await this.svc.cluster(id);
    if (!cluster) throw new NotFoundException("cluster not found");
    return cluster;
  }

  @Get("crte")
  async crteList(
    @Query("region") region?: string,
    @Query("departement") departement?: string,
    @Query("siren") siren?: string,
  ) {
    const items = await this.svc.crteList({ region, departement, siren });
    return { items };
  }

  @Get("crte/:id")
  async crte(@Param("id") id: string) {
    const crte = await this.svc.crte(id);
    if (!crte) throw new NotFoundException("crte not found");
    return crte;
  }

  @Get("communes/:insee/plans")
  async communePlans(@Param("insee") insee: string) {
    const items = await this.svc.communePlans(insee);
    return { items };
  }

  @Get("dispositifs")
  async dispositifs(@Query("type") type?: string, @Query("statut") statut?: string) {
    return this.svc.dispositifs({ type, statut });
  }

  @Get("dispositifs/all")
  async dispositifsAll() {
    return this.svc.dispositifsAll();
  }

  @Get("dispositifs/projets")
  async dispositifsProjets(
    @Query("type") type?: string,
    @Query("statut") statut?: string,
    @Query("source") source?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const p = toInt(page, 0);
    const l = Math.min(toInt(limit, 50), 1000);
    const result = await this.svc.dispositifsProjets({ type, statut, source, page: p, limit: l });
    return { ...result, page: p, limit: l };
  }
}
