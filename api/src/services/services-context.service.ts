import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { ProjetStatus, serviceContext, services } from "@database/schema";
import { and, arrayOverlaps, eq, InferSelectModel, or } from "drizzle-orm";
import { Competences, Leviers } from "@/shared/types";
import { CustomLogger } from "@logging/logger.service";
import { CreateServiceContextRequest, CreateServiceContextResponse } from "@/services/dto/create-service-context.dto";
import { ServicesByProjectIdResponse } from "@/services/dto/service.dto";
import { ExtraFieldConfig } from "./dto/extra-fields-config.dto";

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

  async findMatchingServices(
    competences: Competences | null,
    leviers: Leviers | null,
    projectStatus: ProjetStatus | null,
  ): Promise<ServicesByProjectIdResponse[]> {
    let matchingContexts: JoinResult[] = [];
    const conditions = [];
    const categorizationConditions = [];

    // Build categorization condition (competences OR leviers)
    if (competences?.length) {
      categorizationConditions.push(
        or(arrayOverlaps(serviceContext.competences, competences), eq(serviceContext.competences, [])),
      );
    }
    if (leviers?.length) {
      categorizationConditions.push(or(arrayOverlaps(serviceContext.leviers, leviers), eq(serviceContext.leviers, [])));
    }

    // Add categorization condition if any exists
    if (categorizationConditions.length > 0) {
      conditions.push(or(...categorizationConditions));
    }

    // Add status condition if status is provided
    if (projectStatus) {
      const statusCondition = or(arrayOverlaps(serviceContext.status, [projectStatus]), eq(serviceContext.status, []));
      conditions.push(statusCondition);
    }

    // If no conditions (no categorization and no status), return empty array
    if (conditions.length === 0) {
      return [];
    }

    matchingContexts = await this.dbService.database
      .select()
      .from(serviceContext)
      .innerJoin(services, eq(services.id, serviceContext.serviceId))
      .where(and(eq(services.isListed, true), ...conditions));

    return matchingContexts.map(({ services, service_context }) => ({
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

    const { competences, description, ...otherFields } = createServiceContextDto;

    // Check if a service context with the same description already exists for this service
    if (description) {
      const existingServiceContext = await this.dbService.database
        .select()
        .from(serviceContext)
        .where(and(eq(serviceContext.serviceId, serviceId), eq(serviceContext.description, description)))
        .limit(1);

      if (existingServiceContext.length > 0) {
        throw new ConflictException(
          `A service context with the description "${description}" already exists for this service`,
        );
      }
    }

    const [newServiceContext] = await this.dbService.database
      .insert(serviceContext)
      .values({
        serviceId,
        ...otherFields,
        description,
        competences: competences ?? [],
      })
      .returning();

    this.logger.log("Service context created successfully", {
      serviceContextId: newServiceContext.id,
    });

    return newServiceContext;
  }
}
