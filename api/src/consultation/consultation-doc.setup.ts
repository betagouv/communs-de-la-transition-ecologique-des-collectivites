import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ConsultationModule } from "./consultation.module";

export function setupConsultationDoc(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("API Consultation")
    .setDescription(
      "Consultation de la base consolidée des projets des collectivités (toutes sources : dotations de l'État, " +
        "Fonds Vert, agences de l'eau, ADEME, fonds européens, marchés publics…), au schéma commun v0.2.0. " +
        "Accès restreint aux services de l'État, par clé d'API dédiée, en lecture seule : ce n'est pas un jeu de données ouvert. " +
        "La base est un instantané reconstruit périodiquement : conserver les clés `provenances` des projets, pas une position dans la liste. " +
        "Les labels (thématiques, leviers, nature, budget vert) sont provisoires.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("Consultation", "Projets et indicateurs par collectivité")
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      include: [ConsultationModule],
    });

  SwaggerModule.setup("api/consultation", app, documentFactory, {
    jsonDocumentUrl: "/api/consultation/openapi.json",
    customSiteTitle: "API Consultation - Documentation",
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
