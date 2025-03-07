import { Test, TestingModule } from "@nestjs/testing";
import { ProjetsController } from "./projets.controller";
import { CreateProjetRequest } from "./dto/create-projet.dto";
import { ProjetResponse } from "./dto/projet.dto";
import { getFormattedDate } from "@test/helpers/get-formatted-date";
import { AppModule } from "@/app.module";
import { NotFoundException } from "@nestjs/common";
import { mockRequest } from "@test/mocks/mockRequest";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { CreateProjetsService } from "@projets/services/create-projets/create-projets.service";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";

describe("ProjetsController", () => {
  let controller: ProjetsController;
  let ProjetCreateService: CreateProjetsService;
  let ProjetFindService: GetProjetsService;
  let app: TestingModule;

  const mockedCollectivites: CollectiviteReference[] = [{ type: "Commune", code: "01001" }];

  const expectedProjet: ProjetResponse = {
    id: "test-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    nom: "Test Projet",
    description: "Test Description",
    porteurCodeSiret: "12345678901234",
    porteurReferentEmail: "test@example.com",
    porteurReferentTelephone: null,
    porteurReferentNom: null,
    porteurReferentFonction: null,
    porteurReferentPrenom: null,
    budget: 100000,
    forecastedStartDate: getFormattedDate(),
    source: null,
    status: "IDEE",
    competences: null,
    leviers: null,
    collectivites: mockedCollectivites.map(({ code }) => ({
      codeInsee: code,
      codeEpci: null,
      type: "Commune",
      siren: null,
      codeDepartements: null,
      codeRegions: null,
      nom: "Commune 1",
      id: expect.any(String),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })),
    tetId: null,
    mecId: null,
    recocoId: null,
  };

  beforeEach(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    controller = app.get<ProjetsController>(ProjetsController);
    ProjetCreateService = app.get<CreateProjetsService>(CreateProjetsService);
    ProjetFindService = app.get<GetProjetsService>(GetProjetsService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("create", () => {
    const validProjet: CreateProjetRequest = {
      nom: "Test Projet",
      description: "Test Description",
      porteurCodeSiret: "12345678901234",
      porteurReferentEmail: "test@example.com",
      budget: 100000,
      forecastedStartDate: getFormattedDate(),
      status: "IDEE",
      collectivites: mockedCollectivites,
      externalId: "test-service-id",
    };

    it("should create a new Projet", async () => {
      const expectedResponse = { id: "test-id" };
      jest.spyOn(ProjetCreateService, "create").mockResolvedValue(expectedResponse);

      const result = await controller.create(mockRequest("MEC"), validProjet);

      expect(result).toEqual(expectedResponse);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(ProjetCreateService.create).toHaveBeenCalledWith(validProjet, "MEC_test_api_key");
    });
  });

  describe("findAll", () => {
    it("should return an array of Projets", async () => {
      const expectedProjets: ProjetResponse[] = [expectedProjet];

      jest.spyOn(ProjetFindService, "findAll").mockResolvedValue(expectedProjets);

      const result = await controller.findAll();
      expect(result).toEqual(expectedProjets);
    });
  });

  describe("findOne", () => {
    it("should return a single Projet", async () => {
      jest.spyOn(ProjetFindService, "findOne").mockResolvedValue(expectedProjet);

      const result = await controller.findOne({ id: crypto.randomUUID() });
      expect(result).toEqual(expectedProjet);
    });

    it("should throw NotFoundException for non-existent Projet", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      jest.spyOn(ProjetFindService, "findOne").mockRejectedValue(new NotFoundException());

      await expect(controller.findOne({ id: nonExistentId })).rejects.toThrow(NotFoundException);
    });
  });
});
