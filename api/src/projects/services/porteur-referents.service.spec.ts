import { PorteurReferentsService } from "./porteur-referents.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { TestingModule } from "@nestjs/testing";
import { CreatePorteurReferentDto } from "@projects/dto/create-porteur-referent.dto";

describe("PorteurReferentsService", () => {
  let porteurReferentsService: PorteurReferentsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    porteurReferentsService = module.get<PorteurReferentsService>(
      PorteurReferentsService,
    );
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
  });

  describe("findOrCreate", () => {
    it("should return null if no porteurReferent is provided", async () => {
      await testDbService.database.transaction(async (tx) => {
        const result = await porteurReferentsService.findOrCreate(tx);
        expect(result).toBeNull();
      });
    });

    it("should insert a new porteur referent if it does not exist", async () => {
      const porteurReferent: CreatePorteurReferentDto = {
        email: "test@example.com",
        telephone: "1234567890",
        prenom: "John",
        nom: "Doe",
        fonction: "maire",
      };

      await testDbService.database.transaction(async (tx) => {
        const porteurId = await porteurReferentsService.findOrCreate(
          tx,
          porteurReferent,
        );
        expect(porteurId).toEqual(expect.any(String));

        const createdPorteur = await tx.query.porteurReferents.findFirst({
          where: (porteurs, { eq }) =>
            eq(porteurs.email, porteurReferent.email),
        });

        expect(createdPorteur).toEqual({
          id: expect.any(String),
          ...porteurReferent,
        });
      });
    });

    it("should update an existing porteur referent with new information if provided", async () => {
      const initialPorteur: CreatePorteurReferentDto = {
        email: "existing@example.com",
        telephone: "1234567890",
        prenom: "John",
        nom: "Doe",
      };

      const updatedInfo: CreatePorteurReferentDto = {
        email: "existing@example.com",
        telephone: "0987654321",
        prenom: "Jane",
      };

      await testDbService.database.transaction(async (tx) => {
        await porteurReferentsService.findOrCreate(tx, initialPorteur);

        const porteurId = await porteurReferentsService.findOrCreate(
          tx,
          updatedInfo,
        );

        expect(porteurId).toEqual(expect.any(String));

        const updatedPorteur = await tx.query.porteurReferents.findFirst({
          where: (porteurs, { eq }) => eq(porteurs.email, initialPorteur.email),
        });

        expect(updatedPorteur).toEqual(
          expect.objectContaining({
            ...initialPorteur,
            ...updatedInfo,
            fonction: null,
          }),
        );
      });
    });
  });
});
