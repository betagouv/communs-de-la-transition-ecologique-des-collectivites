import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { CreateServiceRequest, CreateServiceResponse } from "./dto/create-service.dto";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import {
  collectivites,
  mecProjetsOperationnels,
  projets,
  ProjetPhase,
  services,
  tetFichesAction,
} from "@database/schema";
import { ServicesByProjectIdResponse } from "./dto/service.dto";
import { ServicesContextService } from "./services-context.service";
import { CompetenceCodes, IdType, Leviers } from "@/shared/types";
import { RegionCode } from "@/shared/const/region-codes";
import { InferSelectModel } from "drizzle-orm";

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

    if (!project && idType === "communId") {
      const fallback = await this.findFallbackForServices(id);
      if (fallback) {
        return this.serviceContextService.findMatchingServicesContext(
          fallback.competences,
          fallback.leviers,
          fallback.phase,
          fallback.codeRegions,
        );
      }
    }

    if (!project) {
      throw new NotFoundException(`Projet with ${idType} ${id} not found`);
    }

    // Type assertion needed because Drizzle's relational query inference
    // hits TypeScript complexity limits with multi-schema setups
    type Collectivite = InferSelectModel<typeof collectivites>;
    const projectCollectivites = project.collectivites.map(
      (relation: { collectivite: Collectivite }) => relation.collectivite,
    );

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

  /**
   * Search data_mec then data_tet for a project and resolve its region codes.
   */
  private async findFallbackForServices(id: string): Promise<{
    competences: CompetenceCodes | null;
    leviers: Leviers | null;
    phase: ProjetPhase | null;
    codeRegions: RegionCode[];
  } | null> {
    // data_mec
    this.logger.warn("Falling back to data_mec for services project lookup", { id });
    const [mecProjet] = await this.dbService.database
      .select({
        competencesM57: mecProjetsOperationnels.competencesM57,
        leviersSgpe: mecProjetsOperationnels.leviersSgpe,
        phase: mecProjetsOperationnels.phase,
        siren: mecProjetsOperationnels.collectiviteResponsableSiren,
      })
      .from(mecProjetsOperationnels)
      .where(eq(mecProjetsOperationnels.id, id));

    if (mecProjet) {
      const codeRegions = await this.resolveRegionsFromSiren(mecProjet.siren);
      return {
        competences: (mecProjet.competencesM57 as CompetenceCodes) ?? null,
        leviers: (mecProjet.leviersSgpe as Leviers) ?? null,
        phase: mecProjet.phase as ProjetPhase | null,
        codeRegions,
      };
    }

    // data_tet
    this.logger.warn("Falling back to data_tet for services project lookup", { id });
    const [tetFiche] = await this.dbService.database
      .select({
        competencesM57: tetFichesAction.competencesM57,
        leviersSgpe: tetFichesAction.leviersSgpe,
        siren: tetFichesAction.collectiviteResponsableSiren,
      })
      .from(tetFichesAction)
      .where(eq(tetFichesAction.id, id));

    if (tetFiche) {
      const codeRegions = await this.resolveRegionsFromSiren(tetFiche.siren);
      return {
        competences: (tetFiche.competencesM57 as CompetenceCodes) ?? null,
        leviers: (tetFiche.leviersSgpe as Leviers) ?? null,
        phase: null,
        codeRegions,
      };
    }

    return null;
  }

  private async resolveRegionsFromSiren(siren: string | null): Promise<RegionCode[]> {
    if (!siren) return [];
    const [collectivite] = await this.dbService.database
      .select({ codeRegions: collectivites.codeRegions })
      .from(collectivites)
      .where(eq(collectivites.siren, siren));
    return (collectivite?.codeRegions as RegionCode[]) ?? [];
  }
}
