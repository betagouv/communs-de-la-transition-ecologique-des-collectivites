import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { ProjetsModule } from "@projets/projets.module";
import { AidesMatchingService } from "@/aides/aides-matching.service";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

/**
 * Module du back-office. ADDITIF et ISOLÉ : aucun autre module ne l'importe, et il ne modifie
 * rien de l'existant — il réutilise le moteur de matching et le registre de contenu tels quels.
 *
 * Le supprimer : `rm -rf src/admin`, puis retirer son import dans app.module.ts et setup-app.ts.
 * Aucun autre fichier ne bouge, aucun test existant ne casse.
 */
@Module({
  imports: [DatabaseModule, ProjetsModule],
  controllers: [AdminController],
  // Même moteur de score que les aides, les questionnaires et les services : la simulation doit
  // dire la VÉRITÉ. Un portage du scoring dans le back-office afficherait des chiffres faux, et
  // les seuils seraient calibrés sur un mensonge.
  providers: [AdminService, AidesMatchingService],
})
export class AdminModule {}
