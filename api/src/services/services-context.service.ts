import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { ProjectStatus, serviceContext, services } from "@database/schema";
import { arrayOverlaps, eq } from "drizzle-orm";
import { Competences } from "@/shared/types";
import { CustomLogger } from "@logging/logger.service";
import { CompetencesService } from "@projects/services/competences/competences.service";
import { CreateServiceContextRequest, CreateServiceContextResponse } from "@/services/dto/create-service-context.dto";

interface ServiceWithContext {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  redirectionUrl?: string;
  redirectionLabel?: string;
  extendLabel?: string | null;
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
    projectStatus: ProjectStatus | null,
  ): Promise<ServiceWithContext[]> {
    if (!competences?.length && !projectStatus) {
      return [];
    }

    // we shout get competences and sous competences from the project
    // we should also get the levier from the project

    // todo add sous comp
    // todo add project status

    // we should get all the services contexts where the
    // competences and sous competences match and the project status match

    const matchingContexts = await this.dbService.database
      .select()
      .from(serviceContext)
      .innerJoin(services, eq(services.id, serviceContext.serviceId))
      .where(arrayOverlaps(serviceContext.competences, competences ?? []));

    // const matchingContexts = await this.dbService.database
    //   .select()
    //   .from(serviceContext)
    //   .innerJoin(services, eq(services.id, serviceContext.serviceId))
    //   .where(
    //     or(
    //       and(notNull(serviceContext.competences), overlap(serviceContext.competences, competences ?? [])),
    //       and(notNull(serviceContext.sousCompetences), overlap(serviceContext.sousCompetences, sousCompetences ?? [])),
    //       and(
    //         notNull(serviceContext.statuses),
    //         projectStatus ? inArray(serviceContext.statuses, [projectStatus]) : undefined,
    //       ),
    //     ),
    //   );

    if (matchingContexts.length === 0) {
      return [];
    }

    return matchingContexts.map(({ services, service_context }) => ({
      ...services,
      description: service_context.description ?? services.description,
      logoUrl: service_context.logoUrl ?? services.logoUrl,
      redirectionUrl: service_context.redirectionUrl ?? services.redirectionUrl,
      redirectionLabel: service_context.redirectionLabel ?? services.redirectionLabel,
      extendLabel: service_context.extendLabel,
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
