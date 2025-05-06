import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { ProjetPhase, serviceContext, services } from "@database/schema";
import { and, eq, InferSelectModel, sql } from "drizzle-orm";
import { CompetenceCodes, Leviers } from "@/shared/types";
import { CustomLogger } from "@logging/logger.service";
import { CreateServiceContextRequest, CreateServiceContextResponse } from "@/services/dto/create-service-context.dto";
import { ServicesByProjectIdResponse } from "@/services/dto/service.dto";
import { ExtraFieldConfig } from "./dto/extra-fields-config.dto";
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

interface JoinResult {
  services: InferSelectModel<typeof services>;
  service_context: InferSelectModel<typeof serviceContext>;
}

@Injectable()
export class ServicesContextService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly logger: CustomLogger,
  ) {}

  async findMatchingServicesContext(
    competences: CompetenceCodes | null,
    leviers: Leviers | null,
    projetPhase: ProjetPhase | null,
  ): Promise<ServicesByProjectIdResponse[]> {
    // If no criteria provided, return empty array
    if (!competences?.length && !leviers?.length && !projetPhase) {
      return [];
    }

    // Get all service contexts for listed services - this is safe as we have relativly few listed services (less than 100)
    // and it is easier to refine the results programmatically
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

    const serviceContextsMatchingLeviersOrCompetences = allServiceContexts.filter(({ service_context }) => {
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
    });

    const serviceContextsMatchingPhases = serviceContextsMatchingLeviersOrCompetences.filter(({ service_context }) => {
      if (
        // service context with empty array match all possible values
        (projetPhase && service_context.phases?.length === 0) ||
        // some service_context might have null value for phases because phase is not relevant for them. In that case we match them all) ;
        service_context.phases === null
      ) {
        return true;
      }
      // if a project has has no phase that means we haven't managed to determine
      // which phase it correspond to during import (i.e fiche action from tet which can be either operation or etude)
      // for those ones we take the risk to display all services context associated to the competences/leviers regardless of the phase
      if (projetPhase === null) return true;

      return service_context.phases?.includes(projetPhase);
    });

    // Map to the expected response format
    return serviceContextsMatchingPhases.map(({ services, service_context }) => ({
      ...services,
      description: service_context.description ?? services.description,
      sousTitre: service_context.sousTitre ?? services.sousTitre,
      logoUrl: service_context.logoUrl ?? services.logoUrl,
      redirectionUrl: service_context.redirectionUrl ?? services.redirectionUrl,
      redirectionLabel: service_context.redirectionLabel ?? services.redirectionLabel,
      extendLabel: service_context.extendLabel ?? services.extendLabel,
      iframeUrl: service_context.iframeUrl ?? services.iframeUrl,
      // workaround to a specific jsonb array bug in drizzle https://github.com/drizzle-team/drizzle-orm/issues/2913
      extraFields: (service_context.extraFields ?? []) as ExtraFieldConfig[],
    }));
  }

  async getAllServicesContexts(): Promise<ServicesByProjectIdResponse[]> {
    const allServicesContexts = await this.dbService.database
      .select()
      .from(serviceContext)
      .innerJoin(services, eq(services.id, serviceContext.serviceId))
      .orderBy(services.name);

    return allServicesContexts.map(({ services, service_context }) => ({
      ...services,
      description: service_context.description ?? services.description,
      sousTitre: service_context.sousTitre ?? services.sousTitre,
      logoUrl: service_context.logoUrl ?? services.logoUrl,
      redirectionUrl: service_context.redirectionUrl ?? services.redirectionUrl,
      redirectionLabel: service_context.redirectionLabel ?? services.redirectionLabel,
      extendLabel: service_context.extendLabel ?? services.extendLabel,
      iframeUrl: service_context.iframeUrl ?? services.iframeUrl,
      // workaround to a specific jsonb array bug in drizzle https://github.com/drizzle-team/drizzle-orm/issues/2913
      extraFields: (service_context.extraFields ?? []) as ExtraFieldConfig[],
    }));
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

    const { competences, leviers, phases, description, sousTitre, ...otherFields } = createServiceContextDto;

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
      })
      .returning();

    this.logger.log("Service context created successfully", {
      serviceContextId: newServiceContext.id,
    });

    return newServiceContext;
  }
}
