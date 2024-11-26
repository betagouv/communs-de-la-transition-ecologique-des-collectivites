import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { setupApp } from "@/setup-app";
import { e2eTestDbSetup } from "./helpers/e2eTestDbSetup";
import { e2eTearDownSetup } from "./helpers/e2eTearDownSetup";
import { describe } from "node:test";
import { getFutureDate } from "./helpers/getFutureDate";

describe("AppController (e2e)", () => {
  let app: INestApplication;
  const apiKey = process.env.API_KEY;
  beforeAll(async () => {
    // 👍🏼 We're ready
    await e2eTestDbSetup();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    // temporary solution to allow time for the database to start
    // will be changed once the pipelines are splited into different stages with specific
    // service postgres database in github Action - see ticket https://github.com/orgs/betagouv/projects/129/views/1?pane=issue&itemId=86927723
  }, 30000);

  afterAll(async () => {
    // 👋🏼 We're done
    await app?.close();
    await e2eTearDownSetup();
  });

  it("/ (GET)", () => {
    return request(app.getHttpServer())
      .get("/")
      .expect(200)
      .expect("Les communs API");
  });

  describe("Projects (e2e)", () => {
    describe("POST /projects", () => {
      const validProject = {
        nom: "Test Project",
        description: "Test Description",
        codeSiret: "12345678901234",
        porteurEmail: "test@beta.gouv.fr",
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "DRAFT",
        communeInseeCodes: ["01001", "75056", "97A01"],
      };

      it("should reject when wrong api key", async () => {
        const response = await request(app.getHttpServer())
          .post("/projects")
          .set("Authorization", `Bearer wrong-${apiKey}`)
          .send(validProject);

        expect(response.status).toBe(401);
        expect(response.body.message).toContain("Invalid API key");
      });

      it("should reject when nom is empty", async () => {
        const response = await request(app.getHttpServer())
          .post("/projects")
          .set("Authorization", `Bearer ${apiKey}`)
          .send({
            ...validProject,
            nom: "",
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain("nom should not be empty");
      });

      it("should reject when required fields are missing", async () => {
        const response = await request(app.getHttpServer())
          .post("/projects")
          .set("Authorization", `Bearer ${apiKey}`)
          .send({
            nom: "Test Project",
          });

        expect(response.status).toBe(400);
      });

      it("should create a valid project", async () => {
        const response = await request(app.getHttpServer())
          .post("/projects")
          .set("Authorization", `Bearer ${apiKey}`)
          .send(validProject);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          id: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          nom: validProject.nom,
          description: validProject.description,
          codeSiret: validProject.codeSiret,
          porteurEmailHash: expect.any(String),
          budget: validProject.budget,
          forecastedStartDate: validProject.forecastedStartDate,
          status: validProject.status,
          communeInseeCodes: validProject.communeInseeCodes,
        });
      });

      it("should reject when date is in the past", async () => {
        const pastDate = new Date();
        pastDate.setFullYear(pastDate.getFullYear() - 1);
        const pastDateStr = pastDate.toISOString().split("T")[0];

        const response = await request(app.getHttpServer())
          .post("/projects")
          .set("Authorization", `Bearer ${apiKey}`)
          .send({
            ...validProject,
            forecastedStartDate: pastDateStr,
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
          "Forecasted start date must be in the future",
        );
      });
    });
  });
});
