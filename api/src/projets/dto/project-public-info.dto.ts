import { ProjetResponse } from "./projet.dto";
import { PickType } from "@nestjs/swagger";

export class ProjectPublicInfoResponse extends PickType(ProjetResponse, ["description", "phase", "collectivites"]) {}
