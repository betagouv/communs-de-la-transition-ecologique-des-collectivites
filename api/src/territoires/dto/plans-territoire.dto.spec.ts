import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import { PcaetReferenceDto } from "./plans-territoire.dto";

@Controller("t")
class DummyController {
  @Get()
  @ApiOkResponse({ type: PcaetReferenceDto })
  get(): PcaetReferenceDto {
    return null as unknown as PcaetReferenceDto;
  }
}

/**
 * Sylvain (MEC) — le code généré par openapi-typescript rendait `nom`/`sirenPorteur`
 * en `Record<string, never> | null` au lieu de `string | null`, et les marquait
 * optionnels. Cause : `@ApiPropertyOptional({ nullable: true })` SANS `type` →
 * le schéma OpenAPI n'a pas de type (d'où l'objet vide) et le champ n'est pas `required`.
 * Ces champs sont toujours présents dans la réponse (possiblement null), donc requis & typés.
 */
describe("PcaetReferenceDto — contrat OpenAPI", () => {
  let app: INestApplication;
  let schema: SchemaObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [DummyController] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    schema = doc.components!.schemas!.PcaetReferenceDto as SchemaObject;
  });

  afterAll(async () => {
    await app.close();
  });

  it("nom et sirenPorteur sont typés string nullable (pas un objet vide)", () => {
    expect(schema.properties!.nom).toMatchObject({ type: "string", nullable: true });
    expect(schema.properties!.sirenPorteur).toMatchObject({ type: "string", nullable: true });
  });

  it("source et tetExternalId ne sont pas rendus comme objet vide", () => {
    // source : enum string nullable ; tetExternalId : string nullable optionnel
    expect((schema.properties!.source as SchemaObject).type).toBe("string");
    expect((schema.properties!.tetExternalId as SchemaObject).type).toBe("string");
  });

  it("nom, sirenPorteur et source sont requis (toujours présents, jamais undefined)", () => {
    expect(schema.required).toEqual(expect.arrayContaining(["nom", "sirenPorteur", "source"]));
  });

  it("tetExternalId reste optionnel (peut être absent)", () => {
    expect(schema.required ?? []).not.toContain("tetExternalId");
  });
});
