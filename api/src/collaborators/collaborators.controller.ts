import { Controller, Post, Body, Param } from "@nestjs/common";
import { CollaboratorsService } from "./collaborators.service";
import { CreateCollaboratorDto } from "./dto/add-collaborator.dto";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("collaborators")
@Controller("projects/:id/collaborators")
export class CollaboratorsController {
  constructor(private readonly collaboratorsService: CollaboratorsService) {}

  @Post()
  async create(
    @Param("id") projectId: string,
    @Body() CreateCollaboratorDto: CreateCollaboratorDto,
  ) {
    return this.collaboratorsService.create(projectId, CreateCollaboratorDto);
  }
}
