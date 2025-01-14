import { DatabaseService } from "@database/database.service";
import { BadRequestException, Injectable } from "@nestjs/common";
import { CommunesService } from "../communes/communes.service";
import { projects } from "@database/schema";
import { CreateProjectRequest } from "@projects/dto/create-project.dto";
import { CompetencesService } from "@projects/services/competences/competences.service";

@Injectable()
export class CreateProjectsService {
  constructor(
    private dbService: DatabaseService,
    private readonly competencesService: CompetencesService,
    private readonly communesService: CommunesService,
  ) {}

  async create(createProjectDto: CreateProjectRequest): Promise<{ id: string }> {
    this.validateDate(createProjectDto.forecastedStartDate);

    const { competencesAndSousCompetences, ...otherFields } = createProjectDto;
    const { competences, sousCompetences } = this.competencesService.splitCompetence(competencesAndSousCompetences);

    return this.dbService.database.transaction(async (tx) => {
      const [createdProject] = await tx
        .insert(projects)
        .values({
          ...otherFields,
          competences,
          sousCompetences,
        })
        .returning();

      await this.communesService.createOrUpdate(tx, createdProject.id, createProjectDto.communeInseeCodes);

      return { id: createdProject.id };
    });
  }

  private validateDate(dateStr: string): void {
    const inputDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      throw new BadRequestException("Forecasted start date must be in the future");
    }
  }
}
