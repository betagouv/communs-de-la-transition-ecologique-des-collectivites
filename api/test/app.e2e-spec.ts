import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { testDbSetup } from "./testDbSetup";
import { tearDownSetup } from "./tearDownSetup";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // 👍🏼 We're ready
    await testDbSetup();
  });

  afterAll(async () => {
    // 👋🏼 We're done
    await app?.close();
    await tearDownSetup();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
      it("should reject when name is empty", () => {
        return request(app.getHttpServer())
          .post("/projects")
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
          .send({
            name: "Test Project",
            // missing fields
          })
          .expect(400);
      });
    });
  });
});
