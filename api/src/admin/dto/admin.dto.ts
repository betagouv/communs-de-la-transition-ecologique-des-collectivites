import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsUUID } from "class-validator";
import { AideClassification, AideLabelsCommuns } from "@/aides/dto/aides.dto";
import { ProjetPhase } from "@database/schema";
import type { PoidsParPhase } from "@/services-numeriques/service-numerique-contract";
import type {
  BanniereDef,
  QuestionDef,
  RecommandationDef,
  StatutQuestionnaire,
} from "@/questionnaires/questionnaire-contract";

// ⚠️ Ces DTO exposent DÉLIBÉRÉMENT ce que le contrat public cache : conditions, classifications
// d'éligibilité, curation, scores. C'est tout l'intérêt d'un back-office — et c'est pourquoi il
// est derrière la clé d'administration, jamais derrière une clé de plateforme partenaire.
// Le contrat servi à MEC, lui, ne change pas d'un iota.

export class SeuilsResponse {
  @ApiProperty({ description: "Score normalisé minimal pour qu'un service soit jugé pertinent." })
  pertinence!: number;
}

export class EtiquetteManquanteResponse {
  @ApiProperty({ enum: ["thematiques", "sites", "interventions"] })
  axe!: string;

  @ApiProperty() label!: string;
}

export class QuestionnaireContenuResponse {
  @ApiProperty() slug!: string;
  @ApiProperty() libelle!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ type: Object }) banniere!: BanniereDef;
  @ApiProperty({ type: Object, description: "Étiquettes définissantes — jamais exposées à MEC." })
  etiquettesRequises!: { thematiques: readonly string[]; sites: readonly string[]; interventions: readonly string[] };
  @ApiProperty({ type: [Object] }) questions!: QuestionDef[];
  @ApiProperty({ type: [Object], description: "Recommandations AVEC leur condition — jamais exposée à MEC." })
  recommandations!: RecommandationDef[];
}

export class ServiceContenuResponse {
  @ApiProperty() slug!: string;
  @ApiProperty() nom!: string;
  @ApiPropertyOptional({ nullable: true }) profilGeneraliste!: string | null;
  @ApiPropertyOptional({ nullable: true }) presentationGenerique!: string | null;
  @ApiProperty({ type: [String] }) categories!: string[];
  @ApiPropertyOptional({ nullable: true }) niveauExpertise!: string | null;
  @ApiProperty({ type: Object }) classification!: AideClassification;
  @ApiProperty({ type: Object }) phases!: PoidsParPhase;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
}

export class ContenuResponse {
  @ApiProperty({ type: [QuestionnaireContenuResponse] }) questionnaires!: QuestionnaireContenuResponse[];
  @ApiProperty({ type: [ServiceContenuResponse] }) services!: ServiceContenuResponse[];
  @ApiProperty({ type: SeuilsResponse }) seuils!: SeuilsResponse;
}

export class SimulationRequest {
  @ApiProperty({
    description:
      "Identifiant d'un projet RÉEL. On simule sur une vraie classification, avec ses trous : " +
      "un projet fictif composé à la main dirait ce qu'on veut entendre.",
  })
  @IsUUID()
  projetId!: string;

  @ApiPropertyOptional({
    type: Object,
    description:
      "Réponses hypothétiques : { [slug]: { [questionId]: optionId } }. Elles ne sont PAS " +
      "enregistrées — la simulation ne touche jamais à l'état de la collectivité.",
    example: { "atoutbiodiv-salle": { "part-estimee-des-espaces-exterieurs": "importante-plus-de-50" } },
  })
  @IsOptional()
  @IsObject()
  reponses?: Record<string, Record<string, string>>;
}

export class RecommandationSimuleeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() titre!: string;
  @ApiProperty({ description: "Condition `true` : se déclenche dès que le questionnaire est entamé." })
  inconditionnelle!: boolean;
  @ApiProperty({ description: "Sortirait effectivement, compte tenu du score, du statut et de la condition." })
  declenchee!: boolean;
}

export class QuestionnaireSimuleResponse {
  @ApiProperty() slug!: string;
  @ApiProperty({ description: "Le projet porte TOUTES les étiquettes définissantes du questionnaire." })
  retenu!: boolean;
  @ApiProperty({
    type: [EtiquetteManquanteResponse],
    description:
      "Les étiquettes que le projet NE porte PAS (confiance < 0,8). Vide = questionnaire proposé. " +
      "L'éligibilité est un critère, pas un score : « il manque le lieu Place ou centre-bourg » " +
      "dit quoi regarder, là où « score 0,11 » n'apprend rien.",
  })
  etiquettesManquantes!: EtiquetteManquanteResponse[];
  @ApiProperty() statut!: StatutQuestionnaire;
  @ApiProperty({ type: Object }) reponses!: Record<string, string>;
  @ApiProperty({ type: [RecommandationSimuleeResponse] }) recommandations!: RecommandationSimuleeResponse[];
}

export class ServiceSimuleResponse {
  @ApiProperty() slug!: string;
  @ApiProperty() nom!: string;
  @ApiProperty({ description: "Score de matching avant pondération de phase." }) scoreBrut!: number;
  @ApiProperty({ description: "Facteur de phase appliqué (0.5 à 1)." }) facteurPhase!: number;
  @ApiProperty({ description: "Score final = scoreBrut × facteurPhase." }) score!: number;
  @ApiProperty() retenu!: boolean;
  @ApiProperty({ type: Object }) etiquettesCommunes!: AideLabelsCommuns;
  @ApiPropertyOptional({ nullable: true }) profilGeneraliste!: string | null;
  @ApiProperty({ type: [String] }) categories!: string[];
}

export class ProjetSimuleResponse {
  @ApiProperty() id!: string;
  @ApiProperty() nom!: string;
  @ApiPropertyOptional({ nullable: true }) phase!: ProjetPhase | null;
  @ApiPropertyOptional({ type: Object, nullable: true }) classificationScores!: AideClassification | null;
  @ApiPropertyOptional({ nullable: true, description: "Renseigné quand quelque chose empêche tout matching." })
  avertissement!: string | null;
}

export class SimulationResponse {
  @ApiProperty({ type: ProjetSimuleResponse }) projet!: ProjetSimuleResponse;
  @ApiProperty({
    type: [QuestionnaireSimuleResponse],
    description: "TOUS les questionnaires, y compris sous le seuil — pour pouvoir régler le seuil.",
  })
  questionnaires!: QuestionnaireSimuleResponse[];
  @ApiProperty({ type: [ServiceSimuleResponse], description: "TOUS les services, y compris écartés." })
  services!: ServiceSimuleResponse[];
  @ApiProperty({ type: SeuilsResponse }) seuils!: SeuilsResponse;
}
