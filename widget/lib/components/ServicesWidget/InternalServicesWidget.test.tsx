import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { getApiUrl } from "../../utils.ts";
import { ServicesWidget } from "./ServicesWidget.tsx";

const getMockedServices = (env: "prod" | "staging") => [
  {
    id: "1",
    name: `Service 1 ${env}`,
    description: "Description for service 1",
  },
  {
    id: "2",
    name: `Service 2 ${env}`,
    description: "Description for service 2",
  },
  {
    id: "7",
    name: "Bénéfriches",
    description:
      "Bénéfriches quantifie et monétarise les impacts environnementaux, sociaux et économiques d'un projet d'aménagement, sur friche ou en extension urbaine.",
    logoUrl: "https://benefriches.ademe.fr/favicon/favicon-192.png",
    redirectionUrl: "https://benefriches.ademe.fr/",
    iframeUrl:
      "https://benefriches-staging.osc-fr1.scalingo.io/embed/calcul-rapide-impacts-projet-urbain?siteSurfaceArea={surface}&siteCityCode=31070",
    sousTitre: "",
    redirectionLabel: null,
    extendLabel: null,
    extraFields: ["surface"],
  },
];

const server = setupServer();

// Setup & teardown
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("LesCommuns", () => {
  server.use(
    http.get("http://localhost:3000/services/project/123", () => {
      return HttpResponse.json(getMockedServices("prod"));
    }),
  );

  it("displays services when data is loaded", async () => {
    render(<ServicesWidget projectId="123" />);

    await screen.findByRole("heading", { name: /service 1 prod/i });
    await screen.findByRole("heading", { name: /service 2 prod/i });

    expect(screen.getByRole("heading", { name: /description for service 1/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /description for service 2/i })).toBeInTheDocument();
  });

  it("should display extra field input when project has no extra field associated yet", async () => {
    render(<ServicesWidget projectId="123" />);

    expect(await screen.findByRole("textbox", { name: /surface de la friche en m2/i })).toBeInTheDocument();
  });

  it.only("should display iframe or 'voir le détail' button when corresponding extrafield is present", async () => {
    server.use(
      http.get("http://localhost:3000/projects/123/extra-fields", () => {
        return HttpResponse.json({
          extraFields: [{ fieldName: "surface", fieldValue: "1000" }],
        });
      }),
    );
    render(<ServicesWidget projectId="123" />);

    expect(await screen.findByRole("button", { name: /voir le détail/i })).toBeInTheDocument();
  });
});

describe("getApiUrl", () => {
  it("returns localhost URL in dev mode", () => {
    expect(getApiUrl(false, true)).toBe("http://localhost:3000");
  });

  it("returns prod URL in prod mode", () => {
    expect(getApiUrl(false, false)).toBe("https://les-communs-transition-ecologique-api-prod.osc-fr1.scalingo.io");
  });

  it("returns staging URL when isStaging is true in prod mode", () => {
    expect(getApiUrl(true, false)).toBe("https://les-communs-transition-ecologique-api-staging.osc-fr1.scalingo.io");
  });
});
