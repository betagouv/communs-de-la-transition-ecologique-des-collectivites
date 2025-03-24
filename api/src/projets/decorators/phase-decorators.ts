import { PhaseStatut } from "@database/schema";
import { Transform } from "class-transformer";
import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

export function PhaseStatutRequiresPhase(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "EtapeStatutRequiresEtape",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const isPhaseProvided = obj.phase !== undefined && obj.phase !== null;
          const isPhaseStatutNotProvided = value === undefined || value === null;
          return isPhaseProvided || isPhaseStatutNotProvided;
        },
        defaultMessage() {
          return "phaseStatut cannot be specified without a phase";
        },
      },
    });
  };
}

export function SetEnCoursIfPhaseIsProvidedButNoPhaseStatut() {
  return Transform(
    ({ value, obj: payload }: { value: PhaseStatut | null | undefined; obj: Record<string, unknown> }) => {
      if (!value && payload.phase) {
        value = "En cours";
      }

      return value;
    },
  );
}
