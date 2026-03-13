import { Module } from "@nestjs/common";
import { ProjetsV2Controller } from "./projets-v2.controller";

@Module({
  controllers: [ProjetsV2Controller],
})
export class ProjetsV2Module {}
