import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AidesCacheService } from "./aides-cache.service";
import { AidesPerimetreService } from "./aides-perimetre.service";
import { AidesTerritoiresService } from "./aides-territoires.service";

/**
 * Module minimal : « les aides disponibles sur un territoire ».
 *
 * Il existe pour casser un cycle. Le module Aides a besoin des ajouts manuels (pour les fondre
 * dans ses listes) ; les ajouts manuels ont besoin du périmètre (pour refuser une aide hors
 * territoire). Sans ce module intermédiaire, les deux s'importeraient mutuellement.
 *
 * Il PORTE le cache et le client Aides-territoires (au lieu de les laisser au module Aides) :
 * deux modules qui les fourniraient chacun de leur côté ouvriraient deux connexions Redis et
 * deux caches distincts — donc deux vérités.
 */
@Module({
  imports: [ConfigModule],
  providers: [AidesTerritoiresService, AidesCacheService, AidesPerimetreService],
  exports: [AidesTerritoiresService, AidesCacheService, AidesPerimetreService],
})
export class AidesPerimetreModule {}
