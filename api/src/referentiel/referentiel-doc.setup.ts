import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ReferentielModule } from "./referentiel.module";

export function setupReferentielDoc(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("API Référentiel Collectivités")
    .setDescription(
      "API de référence sur les collectivités territoriales, groupements " +
        "et compétences. Données issues de Banatic (DGCL), ZLV et geo.api.gouv.fr.",
    )
    .setVersion("1.0")
    .addTag("Référentiel - Communes", "Communes françaises (34 875 entités)")
    .addTag("Référentiel - Groupements", "EPCI, syndicats, PETR (9 345 entités)")
    .addTag("Référentiel - Compétences", "123 compétences Banatic en 10 catégories")
    .addTag("Référentiel - Recherche", "Recherche transversale par nom")
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      include: [ReferentielModule],
    });

  SwaggerModule.setup("api/referentiel", app, documentFactory, {
    jsonDocumentUrl: "api/referentiel/openapi.json",
    customSiteTitle: "API Référentiel Collectivités - Documentation",
    swaggerOptions: {
      tagsSorter: "alpha",
    },
  });
}
