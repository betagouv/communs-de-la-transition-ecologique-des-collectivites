import { CommunesService } from "./communes.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { TestingModule } from "@nestjs/testing";
import { communes } from "@database/schema";
import { inArray } from "drizzle-orm";

describe("CommunesService", () => {
  let service: CommunesService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

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
  });

  describe("findOrCreateMany", () => {
    it("should handle empty array of insee codes", async () => {
      await testDbService.database.transaction(async (tx) => {
        const result = await service.findOrCreateMany(tx, []);

        expect(result).toEqual([]);

        // Verify no communes were created
        const allCommunes = await tx.select().from(communes);
        expect(allCommunes).toHaveLength(0);
      });
    });

    it("should create new communes when they don't exist", async () => {
      const inseeCodes = ["01002", "75057", "97A02"];

      await testDbService.database.transaction(async (tx) => {
        const result = await service.findOrCreateMany(tx, inseeCodes);

        expect(result).toHaveLength(3);
        expect(result).toEqual(
          expect.arrayContaining(
            inseeCodes.map((code) => ({
              id: expect.any(String),
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
        const firstResult = await service.findOrCreateMany(tx, inseeCodes);
        expect(firstResult).toHaveLength(2);

        const secondResult = await service.findOrCreateMany(tx, inseeCodes);
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
        const initialResult = await service.findOrCreateMany(
          tx,
          initialInseeCodes,
        );
        expect(initialResult).toHaveLength(2);

        const additionalResult = await service.findOrCreateMany(
          tx,
          additionalInseeCodes,
        );
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
