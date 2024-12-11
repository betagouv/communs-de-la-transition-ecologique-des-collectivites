import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateProjectRequest } from "../dto/create-project.dto";
import { UpdateProjectDto } from "../dto/update-project.dto";
import { projects } from "@database/schema";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@/logging/logger.service";
import { ProjectResponse } from "../dto/project.dto";
import { eq } from "drizzle-orm";
import { CommunesService } from "./communes.service";
import { removeUndefined } from "@/shared/utils/remove-undefined";
import { CollaboratorsService } from "@/collaborators/collaborators.service";

@Injectable()
export class ProjectsService {
  constructor(
    private dbService: DatabaseService,
    private readonly communesService: CommunesService,
    private readonly collaboratorService: CollaboratorsService,
    private logger: CustomLogger,
  ) {}

  async create(
    createProjectDto: CreateProjectRequest,
  ): Promise<{ id: string }> {
    this.validateDate(createProjectDto.forecastedStartDate);

    return await this.dbService.database.transaction(async (tx) => {
      const [createdProject] = await tx
        .insert(projects)
        .values(
          removeUndefined({
            ...createProjectDto,
          }),
        )
        .returning();

      if (createProjectDto.porteurReferentEmail) {
        await this.collaboratorService.createOrUpdate(tx, createdProject.id, {
          email: createProjectDto.porteurReferentEmail,
          permissionType: "EDIT",
        });
      }

      await this.communesService.createOrUpdate(
        tx,
        createdProject.id,
        createProjectDto.communeInseeCodes,
      );

      return { id: createdProject.id };
    });
  }

  async findAll(): Promise<ProjectResponse[]> {
    this.logger.debug("Finding all projects");

    const results = await this.dbService.database.query.projects.findMany({
      with: {
        communes: {
          with: {
            commune: true,
          },
        },
      },
    });

    return results.map((result) => ({
      ...result,
      communes: result.communes.map((c) => c.commune),
    }));
  }

  async findOne(id: string): Promise<ProjectResponse> {
    const result = await this.dbService.database.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        communes: {
          with: {
            commune: true,
          },
        },
      },
    });

    if (!result) {
      this.logger.warn("Project not found", { projectId: id });
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return {
      ...result,
      communes: result.communes.map((c) => c.commune),
    };
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<{ id: string }> {
    if (updateProjectDto.forecastedStartDate) {
      this.validateDate(updateProjectDto.forecastedStartDate);
    }

    return await this.dbService.database.transaction(async (tx) => {
      const [existingProject] = await tx
        .select({
          id: projects.id,
          porteurReferentEmail: projects.porteurReferentEmail,
        })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!existingProject) {
        throw new NotFoundException(`Project with ID ${id} not found`);
      }

      const { communeInseeCodes, ...fieldsToUpdate } =
        removeUndefined(updateProjectDto);

      if (communeInseeCodes) {
        await this.communesService.createOrUpdate(tx, id, communeInseeCodes);
      }

      if (
        updateProjectDto.porteurReferentEmail &&
        updateProjectDto.porteurReferentEmail !==
          existingProject.porteurReferentEmail
      ) {
        await this.collaboratorService.createOrUpdate(tx, id, {
          email: updateProjectDto.porteurReferentEmail,
          permissionType: "EDIT",
        });

        // Remove old collaborator if exists
        if (existingProject.porteurReferentEmail) {
          await this.collaboratorService.remove(
            tx,
            id,
            existingProject.porteurReferentEmail,
          );
        }
      }

      // Check if there are fields to update
      // for example you can update only communes which do not need
      // an update of the project table directly
      // todo update updatedAt
      if (Object.keys(fieldsToUpdate).length > 0) {
        await tx
          .update(projects)
          .set(fieldsToUpdate)
          .where(eq(projects.id, id))
          .returning();
      }

      return { id: existingProject.id };
    });
  }

  remove(id: string) {
    return `This action removes a #${id} project`;
  }

  private validateDate(dateStr: string): void {
    const inputDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      throw new BadRequestException(
        "Forecasted start date must be in the future",
      );
    }
  }
}
