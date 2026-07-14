import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AjoutManuelResponse } from "@/ajouts-manuels/dto/ajout-manuel.dto";
import { CATEGORIES, NIVEAUX_EXPERTISE, type Categorie, type NiveauExpertise } from "../service-numerique-contract";

// Sous-ensemble d'AFFICHAGE du catalogue interne.
//
// Les CRITÈRES DE SÉLECTION n'ont ici aucun équivalent — classification sur les 3 axes, phases,
// presentationGenerique : la frontière est structurelle, pas déclarative (§1 de la spec).
//
// `profilGeneraliste` et `niveauExpertise`, eux, SONT exposés : ce sont des propriétés du
// service, pas des règles. Ils ne décident de rien côté serveur ; le client peut donc filtrer
// dessus sans qu'aucune logique métier n'existe en deux exemplaires.

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

  @ApiPropertyOptional({
    description:
      "Le service est-il utilisable par un agent NON SPÉCIALISTE ? Propriété descriptive du " +
      "service (comme `niveauExpertise`), et non un critère de sélection : elle ne décide de rien " +
      "côté serveur. Le client peut filtrer dessus. Absent = le catalogue ne renseigne pas " +
      "l'information — ce qui n'est pas la même chose que `false`.",
  })
  profilGeneraliste?: boolean;

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

  @ApiPropertyOptional({
    type: AjoutManuelResponse,
    description:
      "Présent si ce service a été ajouté À LA MAIN sur ce projet, et non retenu par le score. " +
      "Porte le message de la personne qui l'a ajouté (« recommandé par la DDT lors du COPIL »). " +
      "Absent = le service a été retenu par le moteur.",
  })
  ajoutManuel?: AjoutManuelResponse;
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
