import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { TerritoiresService } from "./territoires.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { mecExternalIds, mecProjetsOperationnels } from "@database/schema";

/**
 * Découplage ETL (2026-09-21) : GET /projets/mec/:externalId/plans-territoire ne dépend plus de
 * schema_commun_v2 pour le TERRITOIRE du projet. Les communes sont lues dans data_mec
 * (territoire_communes, résolu à l'ingestion via api_referentiel), et non plus dans
 * schema_commun_v2.liens_projets_communes (livrable ETL absent hors prod, cf. incident Sylvain
 * du 14/09 qui renvoyait 500 puis, après garde, 404 systématique en staging).
 *
 * Nouveau contrat : la route dégrade en 200 (liste vide) quand la donnée manque, et ne 404 que
 * pour un external_id MEC inconnu. Seul pcaet_reference reste lu dans schema_commun_v2 (étape 2 :
 * matview possédée) → 200 vide tant qu'elle est absente (staging), plus jamais de 500/404 ETL.
 *
 * La base de test (migrations seules) n'a PAS schema_commun_v2 : elle reproduit la condition staging.
 * qualification reste, elle, dépendante de schema_commun_v2 dans cette PR (re-sourcée à l'étape 1a).
 */
describe("TerritoiresService - découplage ETL de plans-territoire (integration)", () => {
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
    await testDbService.database.delete(mecProjetsOperationnels);
    await testDbService.database.delete(mecExternalIds);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 30000);

  it("plansTerritoire dégrade en 200 (liste vide) quand pcaet_reference est absente, projet avec communes", async () => {
    // Projet présent dans data_mec avec des communes résolues → la géo-résolution ne passe PAS
    // par schema_commun_v2. pcaet_reference absente (base de test) → 200 vide, plus de 404 ETL.
    await testDbService.database.insert(mecProjetsOperationnels).values({
      id: PROJET_ID,
      nom: "Projet test",
      territoireCommunes: ["01001"],
    });
    await expect(service.planFichesTerritoire(EXTERNAL_ID)).resolves.toEqual({
      pcaet: [],
      fichesActionSuggerees: [],
    });
  });

  it("plansTerritoire dégrade en 200 (liste vide) quand le projet n'a pas de communes dans data_mec", async () => {
    // external_id résolu mais aucune ligne projets_operationnels → plus de 404 « hors schéma commun ».
    await expect(service.planFichesTerritoire(EXTERNAL_ID)).resolves.toEqual({
      pcaet: [],
      fichesActionSuggerees: [],
    });
  });

  it("plansTerritoire renvoie 404 pour un external_id MEC inconnu", async () => {
    await expect(service.planFichesTerritoire("external-id-inexistant")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("qualification dégrade en 404 quand schema_commun_v2.projets_operationnels est absent", async () => {
    // Non encore re-sourcée sur data_mec (étape 1a) : garde ETL toujours active ici.
    await expect(service.qualification(EXTERNAL_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
