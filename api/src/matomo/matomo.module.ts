import { Global, Module } from "@nestjs/common";
import { MatomoService } from "./matomo.service";

@Global()
@Module({
  providers: [MatomoService],
  exports: [MatomoService],
})
export class MatomoModule {}
