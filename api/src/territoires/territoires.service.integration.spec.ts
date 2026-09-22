import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { TerritoiresService } from "./territoires.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import {
  mecExternalIds,
  mecProjetsOperationnels,
  refCommunes,
  refGroupements,
  refPerimetres,
  snapshotTetPlans,
} from "@database/schema";

/**
 * Découplage ETL du pont : GET /projets/mec/:externalId/plans-territoire ne dépend plus du tout de
 * schema_commun_v2.
 * - Étape 1 : le TERRITOIRE du projet est lu dans data_mec (territoire_communes), plus dans
 *   schema_commun_v2.liens_projets_communes.
 * - Étape 2 : les PCAET sont lus dans la vue POSSÉDÉE `pcaet.reference` (data_tet + snapshot_tet_api
 *   + data_tc_plans + api_referentiel), plus dans la matview ETL schema_commun_v2.pcaet_reference.
 *   La réponse expose le couple deep-link (tetExternalId = planId, collectiviteId).
 *
 * Contrat : 200 (liste vide) quand la donnée manque, 404 seulement pour un external_id MEC inconnu.
 * qualification reste dépendante de schema_commun_v2 (re-sourcée plus tard, étape 1a différée).
 */
describe("TerritoiresService - pont découplé de l'ETL (integration)", () => {
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
    const db = testDbService.database;
    await db.delete(snapshotTetPlans);
    await db.delete(refPerimetres);
    await db.delete(refCommunes);
    await db.delete(refGroupements);
    await db.delete(mecProjetsOperationnels);
    await db.delete(mecExternalIds);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 30000);

  it("plansTerritoire renvoie le PCAET du territoire AVEC le deep-link (planId + collectiviteId) depuis la vue possédée", async () => {
    const db = testDbService.database;
    const EPCI_SIREN = "200000172";
    const COMMUNE = "01001";
    // Référentiel : la commune du projet appartient à l'EPCI porteur (expansion SIREN → communes).
    await db.insert(refGroupements).values({ siren: EPCI_SIREN, nom: "CC Test", type: "CC" });
    await db.insert(refCommunes).values({ codeInsee: COMMUNE, siren: "210100012", nom: "Commune Test" });
    await db.insert(refPerimetres).values({ sirenGroupement: EPCI_SIREN, codeInseeCommune: COMMUNE });
    // Snapshot TeT : un PCAET porté par cet EPCI, avec les 2 ids du deep-link + SIREN résolu.
    await db.insert(snapshotTetPlans).values({
      planId: 6819,
      planNom: "PCAET Test",
      planType: "Plan Climat Air Énergie Territorial",
      collectiviteId: 4936,
      collectiviteNom: "CC Test",
      siren: EPCI_SIREN,
      sirenSource: "groupement_exact",
    });
    // Projet MEC localisé sur la commune.
    await db.insert(mecProjetsOperationnels).values({
      id: PROJET_ID,
      nom: "Projet test",
      territoireCommunes: [COMMUNE],
    });

    const result = await service.planFichesTerritoire(EXTERNAL_ID);

    expect(result.pcaet).toEqual([
      {
        nom: "PCAET Test",
        sirenPorteur: EPCI_SIREN,
        presentDansTet: true,
        tetExternalId: "6819",
        collectiviteId: "4936",
        source: "snapshot",
        rattachement: "aucun",
      },
    ]);
  });

  it("plansTerritoire renvoie 200 (liste vide) quand aucun PCAET ne couvre les communes du projet", async () => {
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

  it("plansTerritoire renvoie 200 (liste vide) quand le projet n'a pas de communes dans data_mec", async () => {
    await expect(service.planFichesTerritoire(EXTERNAL_ID)).resolves.toEqual({
      pcaet: [],
      fichesActionSuggerees: [],
    });
  });

  it("plansTerritoire renvoie 404 pour un external_id MEC inconnu", async () => {
    await expect(service.planFichesTerritoire("external-id-inexistant")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("qualification dégrade en 404 quand schema_commun_v2.projets_operationnels est absent", async () => {
    await expect(service.qualification(EXTERNAL_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
