import { BadRequestException, createParamDecorator, ExecutionContext } from "@nestjs/common";
import { UUIDDto } from "@/shared/dto/uuid";
import { validate } from "class-validator";
import { Request } from "express";
import { IdType } from "@/shared/types";

export interface ProjectIdType {
  communId: UUIDDto["id"];
  tetId: string;
}

export const ProjectId = createParamDecorator(async (_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const id = request.params.id;
  const idType = request.query.idType as IdType;

  if (idType === "communId") {
    const uuidDto = new UUIDDto();
    uuidDto.id = id;
    const errors = await validate(uuidDto);
    if (errors.length > 0) {
      throw new BadRequestException("ID invalide : doit être un UUID valide");
    }
  }

  return id;
});
