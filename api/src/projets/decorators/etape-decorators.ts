import { EtapeStatut } from "@database/schema";
import { Transform } from "class-transformer";
import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

export function EtapeStatutRequiresEtape(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "EtapeStatutRequiresEtape",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const isEtapeProvided = obj.etape !== undefined && obj.etape !== null;
          const isetapeStatutNotProvided = value === undefined || value === null;
          return isEtapeProvided || isetapeStatutNotProvided;
        },
        defaultMessage() {
          return "etapeStatut cannot be specified without an etape";
        },
      },
    });
  };
}

export function SetEnCoursIfEtapeIsProvidedButNoEtapeStatut() {
  return Transform(
    ({ value, obj: payload }: { value: EtapeStatut | null | undefined; obj: Record<string, unknown> }) => {
      if (!value && payload.etape) {
        value = "En cours";
      }

      return value;
    },
  );
}
