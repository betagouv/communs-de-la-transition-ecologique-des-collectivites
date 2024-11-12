import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { Prisma } from "@prisma/client";

export class CreateProjectDto
  implements
    Pick<Prisma.ProjectCreateInput, "name" | "description" | "ownerUserId">
{
  @ApiProperty({
    example: "My Awesome Project",
    description: "The name of the project",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "This is a detailed description of my project",
    description: "The description of the project",
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: "user123",
    description: "The ID of the user who owns this project",
  })
  @IsString()
  @IsNotEmpty()
  ownerUserId: string;
}
