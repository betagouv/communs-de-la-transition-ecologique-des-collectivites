import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { ProjectStatus, serviceContext, services } from "@database/schema";
import { and, arrayOverlaps, eq, InferSelectModel, or } from "drizzle-orm";
import { Competences, Leviers } from "@/shared/types";
import { CustomLogger } from "@logging/logger.service";
import { CreateServiceContextRequest, CreateServiceContextResponse } from "@/services/dto/create-service-context.dto";

type ServiceWithContext = InferSelectModel<typeof services> &
  Pick<InferSelectModel<typeof serviceContext>, "extendLabel">;

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
    projectStatus: ProjectStatus | null,
  ): Promise<ServiceWithContext[]> {
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
      logoUrl: service_context.logoUrl ?? services.logoUrl,
      redirectionUrl: service_context.redirectionUrl ?? services.redirectionUrl,
      redirectionLabel: service_context.redirectionLabel ?? services.redirectionLabel,
      extendLabel: service_context.extendLabel ?? services.extendLabel,
      iframeUrl: service_context.iframeUrl ?? services.iframeUrl,
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

    const { competences, ...otherFields } = createServiceContextDto;

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    const [newServiceContext] = await this.dbService.database
      .insert(serviceContext)
      .values({
        serviceId,
        ...otherFields,
        competences: competences ?? [],
      })
      .returning();

    this.logger.log("Service context created successfully", {
      serviceContextId: newServiceContext.id,
    });

    return newServiceContext;
  }
}
