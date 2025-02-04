import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { ProjectStatus, serviceContext, services } from "@database/schema";
import { arrayOverlaps, eq, InferSelectModel, or } from "drizzle-orm";
import { Competences } from "@/shared/types";
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
    projectStatus: ProjectStatus | null,
  ): Promise<ServiceWithContext[]> {
    if (!competences?.length && !projectStatus) {
      return [];
    }

    // todo add project status
    // todo add code insee

    let matchingContexts: JoinResult[] = [];
    if (competences?.length) {
      matchingContexts = await this.dbService.database
        .select()
        .from(serviceContext)
        .innerJoin(services, eq(services.id, serviceContext.serviceId))
        .where(or(arrayOverlaps(serviceContext.competences, competences), eq(serviceContext.competences, [])));
    }

    if (matchingContexts.length === 0) {
      return [];
    }

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
        statuses: [],
      })
      .returning();

    this.logger.log("Service context created successfully", {
      serviceContextId: newServiceContext.id,
    });

    return newServiceContext;
  }
}
