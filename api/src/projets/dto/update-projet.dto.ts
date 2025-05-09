import { CreateProjetRequest } from "./create-projet.dto";
import { PartialType } from "@nestjs/swagger";

export class UpdateProjetRequest extends PartialType(CreateProjetRequest) {}
