import { Controller, Post, Body, Param } from "@nestjs/common";
import { CollaboratorsService } from "./collaborators.service";
import { CreateCollaboratorDto } from "./dto/add-collaborator.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DatabaseService } from "@database/database.service";

@ApiTags("collaborators")
@ApiBearerAuth()
@Controller("projects/:id/collaborators")
export class CollaboratorsController {
  constructor(
    private readonly collaboratorsService: CollaboratorsService,
    private dbService: DatabaseService,
  ) {}

  @Post()
  async create(
    @Param("id") projectId: string,
    @Body() CreateCollaboratorDto: CreateCollaboratorDto,
  ) {
    return await this.dbService.database.transaction(async (tx) => {
      return this.collaboratorsService.create(
        tx,
        projectId,
        CreateCollaboratorDto,
      );
    });
  }
}
