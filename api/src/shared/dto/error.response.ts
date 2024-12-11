import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponse {
  @ApiProperty({
    type: Number,
    description: "HTTP status code",
  })
  statusCode!: number;

  @ApiProperty({
    type: String,
    description: "Error message",
  })
  message!: string;
}
