import { ApiProperty } from "@nestjs/swagger";
import { IsArray } from "class-validator";
import { serviceContext, services } from "@database/schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

type ServiceBaseFields = Pick<
  InferSelectModel<typeof services>,
  "id" | "name" | "description" | "sousTitre" | "redirectionUrl" | "logoUrl"
>;
type ServiceContextFields = Pick<InferInsertModel<typeof serviceContext>, "extraFields">;

export class ServicesByProjectIdResponse implements ServiceBaseFields, ServiceContextFields {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  sousTitre!: string;

  @ApiProperty()
  redirectionUrl!: string;

  @ApiProperty()
  logoUrl!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  extraFields!: string[];

  @ApiProperty({ nullable: true, type: String })
  redirectionLabel?: string | null;

  @ApiProperty({ nullable: true, type: String })
  iframeUrl?: string | null;

  @ApiProperty({ nullable: true, type: String })
  extendLabel?: string | null;
}
