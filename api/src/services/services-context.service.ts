import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { collectivites, ProjetPhase, serviceContext, services } from "@database/schema";
import { and, eq, InferSelectModel, sql } from "drizzle-orm";
import { CompetenceCodes, Leviers } from "@/shared/types";
import { CustomLogger } from "@logging/logger.service";
import { CreateServiceContextRequest, CreateServiceContextResponse } from "@/services/dto/create-service-context.dto";
import { ServicesByProjectIdResponse } from "@/services/dto/service.dto";
import { ExtraFieldConfig } from "./dto/extra-fields-config.dto";
import { RegionCode } from "@/shared/const/region-codes";
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

interface JoinResult {
  services: InferSelectModel<typeof services>;
  service_context: InferSelectModel<typeof serviceContext>;
}
type Collectivite = InferSelectModel<typeof collectivites>;

@Injectable()
export class ServicesContextService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly logger: CustomLogger,
  ) {}

  async getAllServicesContexts(): Promise<ServicesByProjectIdResponse[]> {
    const allServicesContexts = await this.dbService.database
      .select()
      .from(serviceContext)
      .innerJoin(services, eq(services.id, serviceContext.serviceId))
      .orderBy(services.name);

    return this.mapToServiceResponse(allServicesContexts);
  }

  async create(
    serviceId: string,
    createServiceContextDto: CreateServiceContextRequest,
  ): Promise<CreateServiceContextResponse> {
    this.logger.debug("Creating service context", { dto: createServiceContextDto });

    const service = await this.dbService.database.query.services.findFirst({
      where: eq(services.id, serviceId),
    });
    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    const { competences, leviers, phases, description, sousTitre, name, ...otherFields } = createServiceContextDto;

    const existingServiceContext = await this.dbService.database
      .select()
      .from(serviceContext)
      .where(
        and(
          eq(serviceContext.serviceId, serviceId),
          eq(serviceContext.description, description ?? service.description),
          eq(serviceContext.sousTitre, sousTitre ?? service.sousTitre),
        ),
      )
      .limit(1);

    if (existingServiceContext.length > 0) {
      throw new ConflictException(
        `A service context with the description "${description}" and sousTitre "${sousTitre}" already exists for this service`,
      );
    }

    const [newServiceContext] = await this.dbService.database
      .insert(serviceContext)
      .values({
        serviceId,
        ...otherFields,
        description,
        sousTitre,
        competences,
        leviers,
        phases,
        name,
      })
      .returning();

    this.logger.log("Service context created successfully", {
      serviceContextId: newServiceContext.id,
    });

    return newServiceContext;
  }

  //todo might be useful to mutualize both methods between findMatchingServicesContext and getServiceContextByContext
  async findMatchingServicesContext(
    competences: CompetenceCodes | null,
    leviers: Leviers | null,
    projetPhase: ProjetPhase | null,
    projetCollectivites: Collectivite[],
  ): Promise<ServicesByProjectIdResponse[]> {
    // If no criteria provided, return empty array
    if (!competences?.length && !leviers?.length && !projetPhase) {
      return [];
    }

    // Get all service contexts for listed services
    const allServiceContexts: JoinResult[] = await this.dbService.database
      .select()
      .from(serviceContext)
      .innerJoin(services, eq(services.id, serviceContext.serviceId))
      .where(
        and(
          eq(services.isListed, true),
          // At least one of competences, leviers, or phases must not be null
          sql`NOT (${serviceContext.competences} IS NULL AND ${serviceContext.leviers} IS NULL AND ${serviceContext.phases} IS NULL)`,
        ),
      );

    const filteredResults = allServiceContexts
      .filter((result) => this.filterByCompetencesAndLeviers(result, competences, leviers))
      .filter((result) => this.filterByPhase(result, projetPhase))
      .filter((result) => this.filterByRegions(result, projetCollectivites))
      .filter(({ service_context }) => service_context.isListed);

    return this.mapToServiceResponse(filteredResults);
  }

  async getServiceContextByContext(
    competences: CompetenceCodes | null,
    leviers: Leviers | null,
    phases: ProjetPhase[] | null,
  ): Promise<ServicesByProjectIdResponse[]> {
    // If no criteria provided, return empty array
    if (!competences?.length && !leviers?.length && !phases?.length) {
      return [];
    }

    // Get all service contexts for listed services
    const allServiceContexts: JoinResult[] = await this.dbService.database
      .select()
      .from(serviceContext)
      .innerJoin(services, eq(services.id, serviceContext.serviceId))
      .where(
        and(
          eq(services.isListed, true),
          // At least one of competences, leviers, or phases must not be null
          sql`NOT (${serviceContext.competences} IS NULL AND ${serviceContext.leviers} IS NULL AND ${serviceContext.phases} IS NULL)`,
        ),
      );

    const filteredResults = allServiceContexts
      .filter((result) => this.filterByCompetencesAndLeviers(result, competences, leviers))
      .filter((result) => this.filterByPhasesArray(result, phases))
      .filter((result) => this.filterByRegionsForContext(result))
      .filter(({ service_context }) => service_context.isListed);

    return this.mapToServiceResponse(filteredResults);
  }

  private filterByCompetencesAndLeviers(
    { service_context }: JoinResult,
    competences: CompetenceCodes | null,
    leviers: Leviers | null,
  ) {
    // service context with empty array match all possible values
    if (competences && service_context.competences?.length === 0) return true;
    if (leviers && service_context.leviers?.length === 0) return true;

    // Get both original competences and their parent codes
    // parent code is XX-XX whereas children code is XX-XXX
    const competencesWithParents = competences?.flatMap((competence) => [competence, competence.slice(0, 5)]);

    return (
      competencesWithParents?.some((projetCompetence) => service_context.competences?.includes(projetCompetence)) ||
      leviers?.some((projetLevier) => service_context.leviers?.includes(projetLevier))
    );
  }

  private filterByPhase({ service_context }: JoinResult, projetPhase: ProjetPhase | null) {
    if (
      // service context with empty array match all possible values
      (projetPhase && service_context.phases?.length === 0) ||
      // todo github issue to challenge this modelisation : https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/206
      // some service_context might have null value for phases because phase is not relevant for them. In that case we match them all;
      service_context.phases === null
    ) {
      return true;
    }
    // if a project has no phase that means we haven't managed to determine
    // which phase it correspond to during import (i.e fiche action from tet which can be either operation or etude)
    // for those ones we take the risk to display all services context associated to the competences/leviers regardless of the phase
    if (projetPhase === null) return true;

    return service_context.phases?.includes(projetPhase);
  }

  private filterByPhasesArray({ service_context }: JoinResult, phases: ProjetPhase[] | null) {
    if (
      // service context with empty array match all possible values
      (phases && phases.length > 0 && service_context.phases?.length === 0) ||
      // some service_context might have null value for phases because phase is not relevant for them. In that case we match them all;
      service_context.phases === null
    ) {
      return true;
    }
    // if no phases provided, match all service contexts regardless of phase
    if (!phases || phases.length === 0) return true;

    return phases.some((phase) => service_context.phases?.includes(phase));
  }

  private filterByRegions({ service_context }: JoinResult, projetCollectivites: Collectivite[]) {
    if (service_context.regions?.length === 0) return true;

    const codeRegionsFromProject = projetCollectivites.flatMap((collectivite) => collectivite.codeRegions ?? []);

    return codeRegionsFromProject.some((regionCode) => service_context.regions?.includes(regionCode as RegionCode));
  }

  private filterByRegionsForContext({ service_context }: JoinResult) {
    // For context-based queries, we don't filter by regions since we don't have project collectivites
    // Service contexts with empty regions array match all regions
    return service_context.regions?.length === 0 || true;
  }

  private mapToServiceResponse(results: JoinResult[]): ServicesByProjectIdResponse[] {
    return results.map(({ services, service_context }) => ({
      ...services,
      description: service_context.description ?? services.description,
      sousTitre: service_context.sousTitre ?? services.sousTitre,
      logoUrl: service_context.logoUrl ?? services.logoUrl,
      redirectionUrl: service_context.redirectionUrl ?? services.redirectionUrl,
      redirectionLabel: service_context.redirectionLabel ?? services.redirectionLabel,
      extendLabel: service_context.extendLabel ?? services.extendLabel,
      iframeUrl: service_context.iframeUrl ?? services.iframeUrl,
      name: service_context.name ?? services.name,
      isListed: service_context.isListed ?? services.isListed,
      // workaround to a specific jsonb array bug in drizzle https://github.com/drizzle-team/drizzle-orm/issues/2913
      extraFields: (service_context.extraFields ?? []) as ExtraFieldConfig[],
    }));
  }
}
