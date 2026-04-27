import { Controller, Get, NotFoundException, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { DashboardTeService } from "./dashboard-te.service";

const toInt = (v: string | undefined, def: number) => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
};

@ApiTags("Dashboard TE")
@Controller("dashboard-te")
@UseGuards(ApiKeyGuard)
export class DashboardTeController {
  constructor(private readonly svc: DashboardTeService) {}

  @Get("stats/national")
  statsNational() {
    return this.svc.statsNational();
  }

  @Get("stats/departement/:code")
  statsDepartement(@Param("code") code: string) {
    return this.svc.statsDepartement(code);
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
  async projets(
    @Query("commune") commune?: string,
    @Query("departement") departement?: string,
    @Query("siren") siren?: string,
    @Query("levier") levier?: string,
    @Query("competence") competence?: string,
    @Query("source") source?: string,
    @Query("phase") phase?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const p = toInt(page, 0);
    const l = Math.min(toInt(limit, 50), 200);
    const result = await this.svc.projets({
      commune,
      departement,
      siren,
      levier,
      competence,
      source,
      phase,
      q,
      page: p,
      limit: l,
    });
    return { ...result, page: p, limit: l };
  }

  @Get("projets/:id")
  async projet(@Param("id") id: string) {
    const projet = await this.svc.projet(id);
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
}
