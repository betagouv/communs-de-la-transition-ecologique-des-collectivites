import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

class AjoutBase {
  @ApiPropertyOptional({
    description:
      "Pourquoi cet ajout — « recommandé par la DDT lors du COPIL du 12/03 ». Rendu tel quel au " +
      "client, à côté de l'aide ou du service concerné.",
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ description: "Identifiant de l'agent auteur, si la plateforme le transmet.", maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  auteur?: string;
}

export class AjoutAideRequest extends AjoutBase {
  @ApiProperty({
    description:
      "Identifiant Aides-territoires de l'aide. Elle doit être disponible sur le territoire du " +
      "projet (400 sinon) : une aide hors périmètre ne pourrait jamais être résolue à la lecture, " +
      "et l'ajout resterait invisible sans le moindre message.",
  })
  @IsInt()
  aideId!: number;
}

/**
 * Un service qui n'est PAS au catalogue : un outil local, un service partenaire pas encore
 * benchmarké. L'agent en fournit lui-même les informations.
 *
 * POURQUOI C'EST LÉGITIME ICI, ET PAS POUR UNE AIDE. Le catalogue de services est le NÔTRE : un
 * service qui n'y figure pas existe quand même, et personne d'autre ne peut le décrire. Une aide,
 * elle, n'existe que dans Aides-territoires : une aide qu'ils ne connaissent pas n'a aucune
 * autorité qui la valide, et nous n'aurions aucun moyen de la tenir à jour.
 *
 * On ne demande PAS ses thématiques à l'agent, et c'est délibéré : les thématiques ne servent qu'à
 * SÉLECTIONNER un service pour un projet. Ici la sélection est déjà faite — par un humain. Les
 * réclamer serait exiger une donnée dont personne ne se servira.
 *
 * `categories` et `thematiques` sortent donc vides. Vides plutôt qu'absents : un client qui fait
 * `service.thematiques.map(...)` planterait sur `undefined`.
 */
export class ServiceLibreDto {
  @ApiProperty({ description: "Nom du service, tel qu'il s'affichera." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  nom!: string;

  @ApiProperty({ description: "Description courte, telle qu'elle s'affichera." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ description: "Lien vers le service." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @ApiPropertyOptional({ description: "Libellé du lien (défaut : le client décide)." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  libelleLien?: string;

  @ApiPropertyOptional({ description: "Structure qui opère le service." })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  operateur?: string;

  @ApiPropertyOptional({ description: "URL absolue d'un logo. L'API n'héberge que les logos du catalogue." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  logoUrl?: string;
}

/**
 * Deux façons d'ajouter un service, et EXACTEMENT une des deux :
 *
 * - `slug` : le service est au catalogue. On ne recopie rien — sa fiche reste la source de vérité,
 *   et elle continuera d'évoluer (logo, description, lien). Recopier ici l'aurait figée, et les
 *   deux copies auraient divergé.
 * - `service` : il n'y est pas. L'agent le décrit lui-même ; c'est lui la source.
 *
 * Fournir les deux serait ambigu : lequel affiche-t-on ? Fournir aucun des deux n'ajoute rien. On
 * refuse les deux cas plutôt que de choisir en silence.
 */
export class AjoutServiceRequest extends AjoutBase {
  @ApiPropertyOptional({
    description: "Slug du service, s'il est au catalogue. Exclusif avec `service`.",
  })
  // « Au moins un des deux » est vérifié ici ; « pas les deux » l'est dans le service, où on peut
  // l'expliquer. class-validator ne sait pas exprimer un OU EXCLUSIF sans validateur maison, et un
  // validateur maison pour ça serait plus obscur que la garde explicite.
  @ValidateIf((o: AjoutServiceRequest) => o.service === undefined)
  @IsString({ message: "Fournissez `slug` (service du catalogue) OU `service` (service hors catalogue)." })
  @IsNotEmpty()
  slug?: string;

  @ApiPropertyOptional({
    type: ServiceLibreDto,
    description: "Description d'un service HORS catalogue. Exclusif avec `slug`.",
  })
  @ValidateIf((o: AjoutServiceRequest) => o.slug === undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => ServiceLibreDto)
  service?: ServiceLibreDto;
}

export class AjoutCreeResponse {
  @ApiProperty({ description: "Id de la décision. C'est lui qu'il faut fournir pour retirer l'ajout." })
  decisionId!: string;
}

/** La trace d'un ajout manuel, attachée à l'aide ou au service concerné dans les listes. */
export class AjoutManuelResponse {
  @ApiProperty({ description: "Id de la décision — à fournir pour retirer cet ajout." })
  decisionId!: string;

  @ApiPropertyOptional({ description: "Le message saisi lors de l'ajout." })
  message?: string;

  @ApiProperty({ description: "Plateforme qui a procédé à l'ajout (dérivée de la clé d'API)." })
  plateforme!: string;

  @ApiProperty({ description: "Date de l'ajout (ISO 8601)." })
  date!: string;

  @ApiPropertyOptional({
    description:
      "PROVENANCE — services uniquement. `true` si le service ne vient PAS de notre catalogue : " +
      "ses informations ont été saisies par un agent, il n'a pas de fiche chez nous, et son logo " +
      "n'est pas hébergé par l'API. Le client peut donc le présenter différemment (pas de lien " +
      "vers une fiche catalogue, pas de caution éditoriale de notre part).\n\n" +
      "Ce n'est PAS une information de classification : les thématiques ne servent qu'à SÉLECTIONNER " +
      "un service pour un projet, et un ajout manuel a déjà été sélectionné — par un humain. " +
      "Absent sur les aides, où la notion de catalogue n'a pas de sens.",
  })
  horsCatalogue?: boolean;
}
