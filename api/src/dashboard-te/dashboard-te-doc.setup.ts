import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { DashboardTeModule } from "./dashboard-te.module";

export function setupDashboardTeDoc(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("API Dashboard TE")
    .setDescription(
      "API interne du Dashboard Transition Écologique. " +
        "Lit le schéma unifié `schema_commun_v2` (projets, fiches action, plans, clusters) " +
        "issu de l'agrégation MEC + Fonds Vert + PVD + ACV + TeT + CRTE. " +
        "Auth requise (clé `DashboardTE`) — proxifiée par le Worker Cloudflare via Turnstile + JWT.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("Dashboard TE", "Endpoints consommés par le SPA Dashboard TE V3")
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      include: [DashboardTeModule],
    });

  SwaggerModule.setup("api/dashboard-te", app, documentFactory, {
    jsonDocumentUrl: "/api/dashboard-te/openapi.json",
    customSiteTitle: "API Dashboard TE - Documentation",
    swaggerOptions: {
      tagsSorter: "alpha",
      persistAuthorization: true,
    },
  });
}
