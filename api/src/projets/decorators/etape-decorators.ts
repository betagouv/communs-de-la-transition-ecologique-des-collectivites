import { EtapeStatus } from "@database/schema";
import { Transform } from "class-transformer";
import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

export function EtapeStatusRequiresEtape(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "etapeStatusRequiresEtape",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const isEtapeProvided = obj.etape !== undefined && obj.etape !== null;
          const isEtapeStatusNotProvided = value === undefined || value === null;
          return isEtapeProvided || isEtapeStatusNotProvided;
        },
        defaultMessage() {
          return "etapeStatus cannot be specified without an etape";
        },
      },
    });
  };
}

export function SetEtapeStatusEnCours() {
  return Transform(
    ({ value, obj: payload }: { value: EtapeStatus | null | undefined; obj: Record<string, unknown> }) => {
      // If etape is provided but etapeStatus is not, set etapeStatus to "En cours"
      if (!value && payload.etape) {
        value = "En cours";
      }

      return value;
    },
  );
}
