import { Module } from "@nestjs/common";
import { CollaboratorsService } from "@/collaborators/collaborators.service";
import { CollaboratorsController } from "@/collaborators/collaborators.controller";

@Module({
  controllers: [CollaboratorsController],
  providers: [CollaboratorsService],
  exports: [CollaboratorsService],
})
export class CollaboratorsModule {}
