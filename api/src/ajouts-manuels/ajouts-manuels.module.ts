import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { ProjetsModule } from "@projets/projets.module";
import { DecisionsModule } from "@/decisions/decisions.module";
import { AidesPerimetreModule } from "@/aides/aides-perimetre.module";
import { AjoutsManuelsController } from "./ajouts-manuels.controller";
import { AjoutsManuelsService } from "./ajouts-manuels.service";

/**
 * `DecisionsModule` est importé, pas dupliqué : l'écriture passe par `DecisionsService`, qui porte
 * les invariants du journal (append-only, plateforme dérivée de la clé, compatibilité de
 * `supersedes`). Les insérer nous-mêmes aurait demandé de réimplémenter ces garde-fous — donc de
 * les laisser diverger.
 *
 * `AjoutsManuelsService` est EXPORTÉ : les modules Aides et Services numériques en ont besoin pour
 * fondre les ajouts dans leurs listes.
 */
@Module({
  imports: [DatabaseModule, ProjetsModule, DecisionsModule, AidesPerimetreModule],
  controllers: [AjoutsManuelsController],
  providers: [AjoutsManuelsService],
  exports: [AjoutsManuelsService],
})
export class AjoutsManuelsModule {}
