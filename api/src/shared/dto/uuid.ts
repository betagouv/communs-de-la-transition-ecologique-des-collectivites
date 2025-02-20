import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UUIDDto {
  @ApiProperty({
    description: "An Id in a UUID format",
    type: String,
    format: "uuid",
  })
  @IsUUID()
  id!: string;
}
