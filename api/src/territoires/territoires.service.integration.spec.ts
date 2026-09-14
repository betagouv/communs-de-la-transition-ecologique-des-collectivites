import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { TerritoiresService } from "./territoires.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { mecExternalIds } from "@database/schema";

/**
 * Regression (Sylvain / MEC, 14/09) : GET /projets/mec/:externalId/plans-territoire renvoyait
 * un 500 systématique en staging — `relation "schema_commun_v2.projets_operationnels" does not
 * exist`. schema_commun_v2 est un livrable ETL (cycle blue-green), déployé indépendamment et
 * absent tant que l'ETL n'a pas tourné (cas de staging). Le endpoint doit dégrader en 404
 * explicite, pas planter en 500 — même intention que la garde `pcaetReferenceExists` déjà en place.
 *
 * La base de test (migrations seules) n'a PAS schema_commun_v2 : elle reproduit donc la condition.
 */
describe("TerritoiresService - schema_commun_v2 absent (integration)", () => {
  let service: TerritoiresService;
  let module: TestingModule;
  let testDbService: TestDatabaseService;

  const EXTERNAL_ID = "1225";
  const PROJET_ID = "01900000-0000-7000-8000-000000001225";

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<TerritoiresService>(TerritoiresService);
  });

  beforeEach(async () => {
    await testDbService.database
      .insert(mecExternalIds)
      .values({ objetId: PROJET_ID, serviceType: "MEC", externalId: EXTERNAL_ID });
  });

  afterEach(async () => {
    await testDbService.database.delete(mecExternalIds);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 30000);

  it("plansTerritoire dégrade en 404 quand schema_commun_v2.projets_operationnels est absent", async () => {
    await expect(service.planFichesTerritoire(EXTERNAL_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("qualification dégrade en 404 quand schema_commun_v2.projets_operationnels est absent", async () => {
    await expect(service.qualification(EXTERNAL_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("plansTerritoire renvoie 404 pour un external_id MEC inconnu", async () => {
    await expect(service.planFichesTerritoire("external-id-inexistant")).rejects.toBeInstanceOf(NotFoundException);
  });
});
