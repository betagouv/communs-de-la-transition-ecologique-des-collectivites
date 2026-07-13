import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CATEGORIES, NIVEAUX_EXPERTISE, type Categorie, type NiveauExpertise } from "../service-numerique-contract";

// Sous-ensemble d'AFFICHAGE du catalogue interne. Les critères de sélection et de curation
// (classification sur les 3 axes, phases, aIntegrerMec, presentationGenerique) n'ont ici
// aucun équivalent : la frontière est structurelle, pas déclarative. Aucun critère de
// sélection ne traverse la frontière (§1 de la spec).

export class LienResponse {
  @ApiProperty({ format: "uri" })
  url!: string;

  @ApiPropertyOptional()
  libelle?: string;
}

export class ServiceResponse {
  @ApiProperty({ description: "Identifiant stable.", example: "boussole-de-la-transition-ecologique" })
  id!: string;

  @ApiProperty()
  nom!: string;

  @ApiPropertyOptional()
  baseline?: string;

  @ApiProperty({ description: "Description courte, prête à afficher." })
  description!: string;

  @ApiPropertyOptional({ description: "Description longue, dépliée à la demande." })
  descriptionLongue?: string;

  @ApiPropertyOptional({ format: "uri" })
  logoUrl?: string;

  @ApiProperty({
    enum: CATEGORIES,
    isArray: true,
    description:
      "Nature(s) du service. Un service peut en cumuler plusieurs (un outil expert qui recense " +
      "aussi des aides financières) — d'où un tableau et non une valeur unique.",
  })
  categories!: Categorie[];

  @ApiPropertyOptional({ enum: NIVEAUX_EXPERTISE })
  niveauExpertise?: NiveauExpertise;

  @ApiProperty({ type: [String], description: "Thématiques du service, dans la taxonomie du schéma commun." })
  thematiques!: string[];

  @ApiPropertyOptional()
  operateur?: string;

  @ApiPropertyOptional({ type: LienResponse, description: "Lien sortant vers le service." })
  redirection?: LienResponse;

  @ApiPropertyOptional({
    type: LienResponse,
    description:
      "Aperçu intégré. L'URL peut porter des variables que le client substitue avant affichage : " +
      "{collectiviteType}, {collectiviteCode}, {collectiviteLabel}, {epciCodeSiren}.",
  })
  iframe?: LienResponse;
}

export class ProjetServicesResponse {
  @ApiProperty({
    type: [ServiceResponse],
    description:
      "Services déjà sélectionnés, curés et ORDONNÉS par pertinence décroissante par l'API. " +
      "Le client affiche la liste telle quelle : il ne filtre ni ne trie.",
  })
  services!: ServiceResponse[];
}
