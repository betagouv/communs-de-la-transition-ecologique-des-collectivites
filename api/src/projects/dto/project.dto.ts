import { ApiProperty } from "@nestjs/swagger";
import { projects } from "../../database/schema";
import { InferSelectModel } from "drizzle-orm";

export class ProjectDto implements InferSelectModel<typeof projects> {
  @ApiProperty({
    example: "clg2x3e4h0000ml0g8vfy1q1x",
    description: "The unique identifier of the project",
  })
  id: string;

  @ApiProperty({
    example: "2024-03-19T12:00:00Z",
    description: "When the project was created",
  })
  createdAt: Date;

  @ApiProperty({
    example: "My Awesome Project",
    description: "The name of the project",
  })
  name: string;

  @ApiProperty({
    example: "This is a detailed description of my project",
    description: "The description of the project",
  })
  description: string;

  @ApiProperty({
    example: "user123",
    description: "The ID of the user who owns this project",
  })
  ownerUserId: string;
}
