import { CreateProjectRequest } from "./create-project.dto";
import { PartialType } from "@nestjs/swagger";

export class UpdateProjectDto extends PartialType(CreateProjectRequest) {}
