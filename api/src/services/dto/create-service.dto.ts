import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUrl } from "class-validator";
import { InferInsertModel } from "drizzle-orm";
import { services } from "@database/schema";

export class CreateServiceDto implements InferInsertModel<typeof services> {
  @ApiProperty({
    example: "GitHub",
    description: "The name of the service",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "Version control and collaboration platform",
    description: "The description of the service",
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: "https://github.com/logo.png",
    description: "The URL of the service logo",
  })
  @IsString()
  @IsUrl()
  @IsNotEmpty()
  logoUrl: string;

  @ApiProperty({
    example: "https://github.com",
    description: "The URL of the service",
  })
  @IsString()
  @IsUrl()
  @IsNotEmpty()
  url: string;
}
