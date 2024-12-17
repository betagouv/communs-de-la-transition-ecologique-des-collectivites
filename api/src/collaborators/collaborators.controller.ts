import { Controller, Post, Body, Param } from "@nestjs/common";
import { CollaboratorsService } from "./collaborators.service";
import { CreateCollaboratorRequest, CreateCollaboratorResponse } from "./dto/create-collaborator.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DatabaseService } from "@database/database.service";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";

@ApiTags("collaborators")
@ApiBearerAuth()
@Controller("projects/:id/update-collaborators")
export class CollaboratorsController {
  constructor(
    private readonly collaboratorsService: CollaboratorsService,
    private dbService: DatabaseService,
  ) {}

  @Post()
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateCollaboratorResponse,
    description: "Collaborator updated/created successfully",
  })
  async create(@Param("id") projectId: string, @Body() CreateCollaboratorDto: CreateCollaboratorRequest) {
    return await this.dbService.database.transaction(async (tx) => {
      return this.collaboratorsService.createOrUpdate(tx, projectId, CreateCollaboratorDto);
    });
  }
}
