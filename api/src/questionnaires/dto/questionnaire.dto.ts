import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, registerDecorator, type ValidationOptions } from "class-validator";
import {
  SIGNAUX,
  STATUTS_QUESTIONNAIRE,
  TONS_FEEDBACK,
  TYPES_QUESTION,
  type Signal,
  type StatutQuestionnaire,
  type TonFeedback,
  type TypeQuestion,
} from "../questionnaire-contract";

// Les DTO de sortie sont volontairement DISTINCTS des types de contenu
// (questionnaire-contract.ts) : les champs `eligibilite` et `quand` n'y ont aucun
// équivalent. C'est ce qui garantit structurellement qu'aucune condition ni règle
// d'affichage ne fuit vers le client.

/**
 * Valide que toutes les VALEURS d'un Record sont des chaînes. `@IsString({ each: true })`
 * ne convient pas : `each` n'itère que les tableaux, jamais les valeurs d'un objet — il
 * rejetterait tout Record, y compris valide.
 */
function IsRecordOfStrings(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isRecordOfStrings",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
          return Object.values(value).every((v) => typeof v === "string");
        },
        defaultMessage() {
          return "reponses doit être un objet dont toutes les valeurs sont des chaînes ({ [questionId]: optionId })";
        },
      },
    });
  };
}

export class FeedbackResponse {
  @ApiProperty({ enum: TONS_FEEDBACK })
  ton!: TonFeedback;

  @ApiProperty()
  message!: string;
}

export class OptionResponse {
  @ApiProperty({ description: "Unique au sein de la question." })
  id!: string;

  @ApiProperty()
  libelle!: string;

  @ApiPropertyOptional({ description: "Texte secondaire affiché sous le libellé." })
  aide?: string;

  @ApiProperty({ enum: SIGNAUX, description: "Pastille de couleur associée à l'option." })
  signal!: Signal;

  @ApiPropertyOptional({ type: FeedbackResponse, description: "Explication affichée à la sélection." })
  feedback?: FeedbackResponse;
}

export class QuestionResponse {
  @ApiProperty({ description: "Unique au sein du questionnaire." })
  id!: string;

  @ApiProperty({ enum: TYPES_QUESTION })
  type!: TypeQuestion;

  @ApiProperty()
  intitule!: string;

  @ApiProperty({ type: [OptionResponse], minItems: 2 })
  options!: OptionResponse[];
}

export class BanniereResponse {
  @ApiPropertyOptional()
  icone?: string;

  @ApiProperty()
  titre!: string;

  @ApiProperty()
  sousTitre!: string;
}

export class QuestionnaireResponse {
  @ApiProperty({ description: "Identifiant stable du questionnaire.", example: "atoutbiodiv-salle" })
  slug!: string;

  @ApiProperty({
    minimum: 1,
    description:
      "Fige l'interprétation des réponses. Incrémentée dès que la définition change ; " +
      "les réponses devenues ininterprétables sont écartées à la lecture.",
  })
  version!: number;

  @ApiProperty({
    enum: STATUTS_QUESTIONNAIRE,
    description: "Calculé par l'API : non_commence (aucune réponse), complet (toutes), en_cours (entre les deux).",
  })
  statut!: StatutQuestionnaire;

  @ApiProperty({ type: BanniereResponse })
  banniere!: BanniereResponse;

  @ApiProperty({ type: [QuestionResponse], description: "Dans l'ordre d'affichage." })
  questions!: QuestionResponse[];

  @ApiProperty({
    type: Object,
    description: "Réponses enregistrées : { [questionId]: optionId }. Peut être vide.",
    example: { "part-espaces-exterieurs": "importante" },
  })
  reponses!: Record<string, string>;
}

export class ProjetQuestionnairesResponse {
  @ApiProperty({ type: [QuestionnaireResponse] })
  questionnaires!: QuestionnaireResponse[];
}

export class PutReponsesRequest {
  @ApiProperty({
    type: Object,
    description:
      "Jeu COMPLET des réponses connues ({ [questionId]: optionId }), jamais un delta : " +
      "une question absente est considérée comme non répondue (permet la désélection). " +
      "Toute question ou option inconnue pour ce questionnaire est rejetée en 400.",
    example: { "nature-du-terrain": "friche", "part-espaces-exterieurs": "importante" },
  })
  @IsObject()
  @IsRecordOfStrings()
  reponses!: Record<string, string>;
}
