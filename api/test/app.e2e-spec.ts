import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { testDbSetup } from "./testDbSetup";
import { tearDownSetup } from "./tearDownSetup";
import { ConfigService } from "@nestjs/config";
import { describe } from "node:test";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // 👍🏼 We're ready
    await testDbSetup();
    process.env.API_KEY = "test-api-key";
    // temporary solution to allow time for the database to start
    // will be changed once the pipelines are splited into different stages with specific
    // service postgres db in github Action - see ticket https://github.com/orgs/betagouv/projects/129/views/1?pane=issue&itemId=86927723
  }, 30000);

  afterAll(async () => {
    // 👋🏼 We're done
    await app?.close();
    await tearDownSetup();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key) => {
          if (key === "API_KEY") return "test-api-key";
          return null;
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  it("/ (GET)", () => {
    return request(app.getHttpServer())
      .get("/")
      .expect(200)
      .expect("Hello World!");
  });

  describe("Projects (e2e)", () => {
    describe("POST /projects", () => {
      it("should reject when wrong api key", () => {
        return request(app.getHttpServer())
          .post("/projects")
          .set("X-API-Key", "wrong-api-key") // Add this line
          .send({
            name: "",
            description: "Test Description",
            ownerUserId: "user1",
          })
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain("Invalid API key");
          });
      });

      it("should reject when name is empty", () => {
        return request(app.getHttpServer())
          .post("/projects")
          .set("X-API-Key", "test-api-key") // Add this line
          .send({
            name: "",
            description: "Test Description",
            ownerUserId: "user1",
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain("name should not be empty");
          });
      });

      it("should reject when required fields are missing", () => {
        return request(app.getHttpServer())
          .post("/projects")
          .set("X-API-Key", "test-api-key")
          .send({
            name: "Test Project",
            // missing fields
          })
          .expect(400);
      });
    });
  });
});
