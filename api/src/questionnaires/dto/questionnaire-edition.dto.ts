import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import type { BanniereDef, EtiquettesRequises, QuestionDef, RecommandationDef } from "../questionnaire-contract";

/**
 * Le questionnaire ENTIER, tel qu'il sera enregistré. PUT, pas PATCH : un éditeur envoie le
 * document qu'il a sous les yeux. Un PATCH champ par champ ouvrirait la porte à des états
 * incohérents entre deux appels — une condition sauvegardée avant la question qu'elle vise.
 *
 * La validation de FOND (étiquettes dans la taxonomie, conditions résolubles, ids uniques) n'est
 * PAS ici : elle vit dans `validerDefinition`, seule autorité, appelée par le dépôt à l'écriture.
 * La rejouer ici donnerait deux règles à tenir en phase.
 */
export class QuestionnaireEditionRequest {
  @ApiProperty({ description: "Nom du partenaire qui fournit le contenu (« AtoutBiodiv »)." })
  @IsString()
  @IsNotEmpty()
  sourceNom!: string;

  @ApiProperty({ type: Object, description: "Bandeau : { icone, titre, sousTitre }." })
  @IsObject()
  banniere!: BanniereDef;

  @ApiProperty({ type: [Object], description: "Questions et leurs options." })
  @IsArray()
  questions!: QuestionDef[];

  @ApiProperty({ type: [Object], description: "Recommandations AVEC leurs conditions." })
  @IsArray()
  recommandations!: RecommandationDef[];

  @ApiProperty({ type: Object, description: "Étiquettes que le projet doit TOUTES porter." })
  @IsObject()
  etiquettesRequises!: EtiquettesRequises;

  @ApiPropertyOptional({ description: "Qui édite — pour la traçabilité." })
  @IsOptional()
  @IsString()
  editePar?: string;
}

/** Les taxonomies fermées, servies à l'éditeur pour qu'il ne propose QUE des étiquettes valides. */
export class TaxonomiesResponse {
  @ApiProperty({ type: [String] })
  thematiques!: string[];

  @ApiProperty({ type: [String] })
  sites!: string[];

  @ApiProperty({ type: [String] })
  interventions!: string[];
}
