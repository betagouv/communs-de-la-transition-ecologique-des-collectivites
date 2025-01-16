import { DatabaseService } from "@database/database.service";
import { projects } from "@database/schema";
import { UpdateProjectDto } from "@projects/dto/update-project.dto";
import { removeUndefined } from "@/shared/utils/remove-undefined";
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { CommunesService } from "../communes/communes.service";
import { CompetencesService } from "@projects/services/competences/competences.service";

@Injectable()
export class UpdateProjectsService {
  constructor(
    private dbService: DatabaseService,
    private readonly communesService: CommunesService,
    private readonly competencesService: CompetencesService,
  ) {}

  async update(id: string, updateProjectDto: UpdateProjectDto): Promise<{ id: string }> {
    const { competencesAndSousCompetences, ...otherFields } = updateProjectDto;
    const { competences, sousCompetences } = this.competencesService.splitCompetence(competencesAndSousCompetences);

    return this.dbService.database.transaction(async (tx) => {
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

      const { communeInseeCodes, ...fieldsToUpdate } = removeUndefined({
        ...otherFields,
        competences,
        sousCompetences,
      });

      if (communeInseeCodes) {
        await this.communesService.createOrUpdate(tx, id, communeInseeCodes);
      }

      if (Object.keys(fieldsToUpdate).length > 0) {
        await tx.update(projects).set(fieldsToUpdate).where(eq(projects.id, id));
      }

      return { id: existingProject.id };
    });
  }
}
