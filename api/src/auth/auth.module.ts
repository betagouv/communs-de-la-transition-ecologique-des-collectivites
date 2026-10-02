import { Global, Module } from "@nestjs/common";
import { ApiKeysService } from "./api-keys.service";

// Global : ApiKeyGuard est utilisé par @UseGuards dans de nombreux modules,
// qui doivent tous pouvoir résoudre sa dépendance ApiKeysService.
@Global()
@Module({
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class AuthModule {}
