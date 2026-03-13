import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { PlansFichesModule } from "./plans-fiches.module";

export function setupOpendataDoc(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("API Opendata — Plans climat (PCAET)")
    .setDescription(
      "Données opendata issues de Territoires Climat (ADEME). " +
        "Expose les Plans Climat-Air-Énergie Territoriaux (PCAET) publiés " +
        "et leurs fiches action associées.",
    )
    .setVersion("1.0")
    .addTag("Opendata - Plans & Fiches Action", "PCAET publiés et fiches action (source : Territoires Climat)")
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      include: [PlansFichesModule],
    });

  SwaggerModule.setup("api/opendata", app, documentFactory, {
    jsonDocumentUrl: "api/opendata/openapi.json",
    customSiteTitle: "API Opendata PCAET - Documentation",
    swaggerOptions: {
      tagsSorter: "alpha",
    },
  });
}
