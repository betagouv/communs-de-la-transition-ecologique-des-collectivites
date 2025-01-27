import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { ProjectStatus, serviceContext, services } from "@database/schema";
import { arrayOverlaps, eq, InferSelectModel } from "drizzle-orm";
import { Competences, SousCompetences } from "@/shared/types";
import { CustomLogger } from "@logging/logger.service";
import { CompetencesService } from "@projects/services/competences/competences.service";
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
    private readonly competencesService: CompetencesService,
    private readonly logger: CustomLogger,
  ) {}

  async findMatchingServices(
    competences: Competences | null,
    sousCompetences: SousCompetences | null,
    projectStatus: ProjectStatus | null,
  ): Promise<ServiceWithContext[]> {
    if (!competences?.length && !projectStatus) {
      return [];
    }

    // todo add project status
    // todo add code insee

    // First try to match by sous competences if they exist
    let matchingContexts: JoinResult[] = [];
    if (sousCompetences?.length) {
      matchingContexts = await this.dbService.database
        .select()
        .from(serviceContext)
        .innerJoin(services, eq(services.id, serviceContext.serviceId))
        .where(arrayOverlaps(serviceContext.sousCompetences, sousCompetences));
    }

    // If no matches found with sous competences or no sous competences provided,
    // fall back to matching by base competences
    if (matchingContexts.length === 0 && competences?.length) {
      matchingContexts = await this.dbService.database
        .select()
        .from(serviceContext)
        .innerJoin(services, eq(services.id, serviceContext.serviceId))
        .where(arrayOverlaps(serviceContext.competences, competences));
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

  async create(createServiceContextDto: CreateServiceContextRequest): Promise<CreateServiceContextResponse> {
    this.logger.debug("Creating service context", { dto: createServiceContextDto });

    const service = await this.dbService.database.query.services.findFirst({
      where: eq(services.id, createServiceContextDto.serviceId),
    });
    const { competencesAndSousCompetences, ...otherFields } = createServiceContextDto;
    const { competences, sousCompetences } = this.competencesService.splitCompetence(competencesAndSousCompetences);

    if (!service) {
      throw new NotFoundException(`Service with ID ${createServiceContextDto.serviceId} not found`);
    }

    const [newServiceContext] = await this.dbService.database
      .insert(serviceContext)
      .values({ ...otherFields, competences, sousCompetences })
      .returning();

    this.logger.log("Service context created successfully", {
      serviceContextId: newServiceContext.id,
    });

    return newServiceContext;
  }
}
