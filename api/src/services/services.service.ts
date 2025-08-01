import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { CreateServiceRequest, CreateServiceResponse } from "./dto/create-service.dto";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { projets, services } from "@database/schema";
import { ServicesByProjectIdResponse } from "./dto/service.dto";
import { ServicesContextService } from "./services-context.service";
import { CompetenceCodes, IdType, Leviers } from "@/shared/types";
import { RegionCode } from "@/shared/const/region-codes";

@Injectable()
export class ServicesService {
  constructor(
    private dbService: DatabaseService,
    private logger: CustomLogger,
    private serviceContextService: ServicesContextService,
  ) {}

  async create(createServiceDto: CreateServiceRequest): Promise<CreateServiceResponse> {
    this.logger.debug("Creating new service", { dto: createServiceDto });

    const existingService = await this.dbService.database
      .select()
      .from(services)
      .where(eq(services.name, createServiceDto.name))
      .limit(1);

    if (existingService.length > 0) {
      throw new ConflictException(`A service with the name "${createServiceDto.name}" already exists`);
    }

    const [newService] = await this.dbService.database.insert(services).values(createServiceDto).returning();

    this.logger.log("Service created successfully", {
      serviceId: newService.id,
    });

    return newService;
  }

  async findAll() {
    return this.dbService.database.select().from(services);
  }

  async findOne(id: string) {
    const [service] = await this.dbService.database.select().from(services).where(eq(services.id, id));

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return service;
  }

  async getServicesByProjectId(id: string, idType: IdType): Promise<ServicesByProjectIdResponse[]> {
    const whereCondition = idType === "tetId" ? eq(projets.tetId, id) : eq(projets.id, id);

    const project = await this.dbService.database.query.projets.findFirst({
      where: whereCondition,
      with: {
        collectivites: {
          with: {
            collectivite: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Projet with ${idType} ${id} not found`);
    }

    const projectCollectivites = project.collectivites.map((relation) => relation.collectivite);

    const codeRegionsFromProject = projectCollectivites.flatMap(
      (collectivite) => (collectivite.codeRegions as RegionCode[]) ?? [],
    );

    return this.serviceContextService.findMatchingServicesContext(
      project.competences as CompetenceCodes,
      project.leviers as Leviers,
      project.phase,
      codeRegionsFromProject,
    );
  }
}
