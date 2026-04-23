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

  @Get("collectivites")
  collectivites(
    @Query("region") region?: string,
    @Query("departement") departement?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.svc
      .collectivites({
        region,
        departement,
        page: toInt(page, 0),
        limit: Math.min(toInt(limit, 50), 200),
      })
      .then((items) => ({ items, page: toInt(page, 0), limit: Math.min(toInt(limit, 50), 200) }));
  }

  @Get("collectivites/:siren")
  collectivite(@Param("siren") siren: string) {
    return this.svc.collectivite(siren);
  }

  @Get("projets")
  async projets(
    @Query("commune") commune?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const items = await this.svc.projets({
      commune,
      q,
      page: toInt(page, 0),
      limit: Math.min(toInt(limit, 50), 200),
    });
    return { items, page: toInt(page, 0), limit: Math.min(toInt(limit, 50), 200) };
  }

  @Get("fiches")
  async fiches(
    @Query("plan") plan?: string,
    @Query("commune") commune?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const items = await this.svc.fiches({
      plan,
      commune,
      page: toInt(page, 0),
      limit: Math.min(toInt(limit, 50), 200),
    });
    return { items, page: toInt(page, 0), limit: Math.min(toInt(limit, 50), 200) };
  }

  @Get("plans")
  async plans(
    @Query("siren") siren?: string,
    @Query("crte") crte?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const items = await this.svc.plans({
      siren,
      crte,
      page: toInt(page, 0),
      limit: Math.min(toInt(limit, 50), 200),
    });
    return { items, page: toInt(page, 0), limit: Math.min(toInt(limit, 50), 200) };
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
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const items = await this.svc.clusters({
      confidence,
      page: toInt(page, 0),
      limit: Math.min(toInt(limit, 50), 200),
    });
    return { items, page: toInt(page, 0), limit: Math.min(toInt(limit, 50), 200) };
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
}
