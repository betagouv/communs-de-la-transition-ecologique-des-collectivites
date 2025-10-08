/* eslint-disable @typescript-eslint/no-unused-vars */

import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateProjetRequest } from "../../dto/create-projet.dto";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { getFormattedDate } from "@test/helpers/get-formatted-date";
import { UpdateProjetsService } from "./update-projets.service";
import { collectivites } from "@database/schema";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { CreateProjetsService } from "@projets/services/create-projets/create-projets.service";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";
import { UpdateProjetRequest } from "@projets/dto/update-projet.dto";

describe("ProjetUpdateService", () => {
  let updateService: UpdateProjetsService;
  let createService: CreateProjetsService;
  let findService: GetProjetsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let ProjetId: string;

  const MEC_API_KEY = process.env.MEC_API_KEY!;
  const EXTERNAL_ID = "test-service-id";
  const mockedCollectivites: CollectiviteReference = { type: "Commune", code: "01001" };

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    updateService = module.get<UpdateProjetsService>(UpdateProjetsService);
    createService = module.get<CreateProjetsService>(CreateProjetsService);
    findService = module.get<GetProjetsService>(GetProjetsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();

    await testDbService.database.insert(collectivites).values({
      type: mockedCollectivites.type,
      codeInsee: mockedCollectivites.code,
      nom: "Commune 1",
    });

    const createDto: CreateProjetRequest = {
      nom: "Initial Projet",
      description: "Initial Description",
      porteur: {
        referentEmail: "initial@email.com",
      },
      budgetPrevisionnel: 100000,
      dateDebutPrevisionnelle: getFormattedDate(),
      phase: "Idée",
      collectivites: [mockedCollectivites],
      externalId: EXTERNAL_ID,
    };

    const result = await createService.create(createDto, MEC_API_KEY);

    ProjetId = result.id;
  });

  it("should update basic Projet fields", async () => {
    const updateDto = {
      nom: "Updated Projet",
      description: "Updated Description",
      budgetPrevisionnel: 200000,
      externalId: EXTERNAL_ID,
    };

    await updateService.update(ProjetId, updateDto);
    const updatedProjet = await findService.findOne(ProjetId);
    const { externalId, ...expectedfields } = updateDto;

    expect(updatedProjet).toMatchObject({
      ...expectedfields,
      id: ProjetId,
      porteur: {
        referentEmail: "initial@email.com",
      },
      collectivites: expect.arrayContaining([
        {
          codeInsee: mockedCollectivites.code,
          codeEpci: null,
          type: "Commune",
          siren: null,
          codeDepartements: null,
          codeRegions: null,
          nom: "Commune 1",
          id: expect.any(String),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]),
    });
  });

  it("should update competences properly", async () => {
    const updateDto: UpdateProjetRequest = {
      nom: "Updated Projet",
      description: "Updated Description",
      competences: ["90-411", "90-311"],
      budgetPrevisionnel: 200000,
      externalId: EXTERNAL_ID,
    };

    const { externalId, ...expectedFields } = updateDto;

    await updateService.update(ProjetId, updateDto);
    const updatedProjet = await findService.findOne(ProjetId);

    expect(updatedProjet).toMatchObject({
      ...expectedFields,
      id: ProjetId,
      porteur: {
        referentEmail: "initial@email.com",
      },
    });
  });

  it("should only update collectivites when this is the only change", async () => {
    const newCollectivite: CollectiviteReference = { code: "new_EPCI", type: "EPCI" };

    await testDbService.database.insert(collectivites).values({
      type: newCollectivite.type,
      codeEpci: newCollectivite.code,
      nom: "new EPCI Collectivite",
    });

    const updateDto: UpdateProjetRequest = {
      collectivites: [newCollectivite],
      externalId: EXTERNAL_ID,
    };

    await updateService.update(ProjetId, updateDto);
    const updatedProjet = await findService.findOne(ProjetId);

    expect(updatedProjet.collectivites).toHaveLength(1);
    expect(updatedProjet.collectivites[0]).toMatchObject({
      type: newCollectivite.type,
      codeEpci: newCollectivite.code,
      nom: "new EPCI Collectivite",
    });
  });

  it("should throw NotFoundException when Projet doesn't exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const updateDto = { nom: "Updated Name", externalId: "test-external-id-4" };

    await expect(updateService.update(nonExistentId, updateDto)).rejects.toThrow(NotFoundException);
    await expect(updateService.update(nonExistentId, updateDto)).rejects.toThrow(
      `Projet with ID ${nonExistentId} not found`,
    );
  });
});
