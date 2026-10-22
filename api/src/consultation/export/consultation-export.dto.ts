import { ApiProperty } from "@nestjs/swagger";
import { EXPORT_PROFILES, ExportProfile } from "../consultation.service";

export class ExportFichierResponse {
  @ApiProperty({
    enum: EXPORT_PROFILES,
    description:
      "`interne_etat` pour un service habilité aux données internes à l'État, sinon `opendata` (lignes `ouvert` seules).",
  })
  profil!: ExportProfile;

  @ApiProperty({ format: "date-time", description: "Fin de génération du fichier." })
  generatedAt!: string;

  @ApiProperty({ description: "Nombre de projets (une ligne JSON par projet)." })
  nbProjets!: number;

  @ApiProperty({ description: "Taille du fichier compressé, en octets." })
  octets!: number;

  @ApiProperty({ description: "Empreinte SHA-256 du fichier compressé, pour vérifier le téléchargement." })
  sha256!: string;

  @ApiProperty({ description: "Lien de téléchargement direct, valable `urlExpireDans` secondes." })
  url!: string;

  @ApiProperty({ description: "Durée de validité du lien, en secondes." })
  urlExpireDans!: number;
}
