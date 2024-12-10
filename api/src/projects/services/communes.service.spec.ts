import { CommunesService } from "./communes.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { TestingModule } from "@nestjs/testing";
import { communes, projects } from "@database/schema";
import { inArray } from "drizzle-orm";
import { getFutureDate } from "@test/helpers/getFutureDate";

describe("CommunesService", () => {
  let service: CommunesService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let projectId: string;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<CommunesService>(CommunesService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();

    const [project] = await testDbService.database
      .insert(projects)
      .values({
        nom: "Test Project",
        description: "Test Description",
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "DRAFT",
      })
      .returning();

    projectId = project.id;
  });

  describe("findOrCreateMany", () => {
    it("should create new communes when they don't exist", async () => {
      const inseeCodes = ["01002", "75057", "97A02"];

      await testDbService.database.transaction(async (tx) => {
        await service.createOrUpdate(tx, projectId, inseeCodes);

        const result = await tx
          .select()
          .from(communes)
          .where(inArray(communes.inseeCode, inseeCodes));

        expect(result).toHaveLength(3);
        expect(result).toEqual(
          expect.arrayContaining(
            inseeCodes.map((code) => ({
              inseeCode: code,
            })),
          ),
        );

        const createdCommunes = await tx
          .select()
          .from(communes)
          .where(inArray(communes.inseeCode, inseeCodes));

        expect(createdCommunes).toHaveLength(3);
        expect(createdCommunes).toEqual(result);
      });
    });

    it("should return existing communes without creating duplicates", async () => {
      const inseeCodes = ["01003", "75058"];

      await testDbService.database.transaction(async (tx) => {
        await service.createOrUpdate(tx, projectId, inseeCodes);

        const firstResult = await tx
          .select()
          .from(communes)
          .where(inArray(communes.inseeCode, inseeCodes));
        expect(firstResult).toHaveLength(2);

        await service.createOrUpdate(tx, projectId, inseeCodes);
        const secondResult = await tx
          .select()
          .from(communes)
          .where(inArray(communes.inseeCode, inseeCodes));
        expect(secondResult).toHaveLength(2);

        const allCommunes = await tx
          .select()
          .from(communes)
          .where(inArray(communes.inseeCode, inseeCodes));

        expect(allCommunes).toHaveLength(2);
        expect(firstResult).toEqual(secondResult);
      });
    });

    it("should handle mix of existing and new communes", async () => {
      const initialInseeCodes = ["01003", "75059"];
      const additionalInseeCodes = ["97A03", "75059"];

      await testDbService.database.transaction(async (tx) => {
        await service.createOrUpdate(tx, projectId, initialInseeCodes);
        const initialResult = await tx
          .select()
          .from(communes)
          .where(inArray(communes.inseeCode, initialInseeCodes));
        expect(initialResult).toHaveLength(2);

        await service.createOrUpdate(tx, projectId, additionalInseeCodes);
        const additionalResult = await tx
          .select()
          .from(communes)
          .where(inArray(communes.inseeCode, initialInseeCodes));
        expect(additionalResult).toHaveLength(2);

        const allCommunes = await tx
          .select()
          .from(communes)
          .where(
            inArray(communes.inseeCode, [
              ...initialInseeCodes,
              ...additionalInseeCodes,
            ]),
          );

        expect(allCommunes).toHaveLength(3);
        expect(allCommunes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ inseeCode: "01003" }),
            expect.objectContaining({ inseeCode: "75059" }),
            expect.objectContaining({ inseeCode: "97A03" }),
          ]),
        );
      });
    });
  });
});
