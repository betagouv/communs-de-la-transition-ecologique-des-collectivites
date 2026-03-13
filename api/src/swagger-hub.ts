import { INestApplication } from "@nestjs/common";
import { SwaggerModule } from "@nestjs/swagger";

export function setupSwaggerHub(app: INestApplication) {
  // Empty document — the hub only serves as a Swagger UI entry point
  // with a dropdown to switch between APIs
  SwaggerModule.setup("api", app, () => ({ openapi: "3.0.0", info: { title: "", version: "" }, paths: {} }), {
    customSiteTitle: "API Collectivités - Documentation",
    swaggerOptions: {
      urls: [
        { name: "API Référentiel Collectivités", url: "/api/referentiel/openapi.json" },
        { name: "API Opendata — PCAET", url: "/api/opendata/openapi.json" },
        { name: "API Projets (legacy)", url: "/api/projets/openapi.json" },
      ],
    },
  });
}
