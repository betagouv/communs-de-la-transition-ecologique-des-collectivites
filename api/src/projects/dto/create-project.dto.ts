import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { projects } from "../../database/schema";
import { InferInsertModel } from "drizzle-orm";

// Omit id and createdAt as they're auto-generated
export class CreateProjectDto implements InferInsertModel<typeof projects> {
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
