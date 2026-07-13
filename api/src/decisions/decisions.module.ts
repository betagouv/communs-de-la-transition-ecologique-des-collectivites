import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { DecisionsController } from "./decisions.controller";
import { DecisionsService } from "./decisions.service";

@Module({
  imports: [DatabaseModule],
  controllers: [DecisionsController],
  providers: [DecisionsService],
  // Exporté : l'arbitrage des recommandations passe par le même journal, et réutilise
  // ainsi la validation de contrat et le contrôle de compatibilité des révocations.
  exports: [DecisionsService],
})
export class DecisionsModule {}
