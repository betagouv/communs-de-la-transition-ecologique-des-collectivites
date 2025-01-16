import { Test, TestingModule } from "@nestjs/testing";
import { CompetencesService } from "./competences.service";

describe("CompetencesService", () => {
  let service: CompetencesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompetencesService],
    }).compile();

    service = module.get<CompetencesService>(CompetencesService);
  });

  describe("splitCompetence", () => {
    it("should return null for both competences and sousCompetences when input is null", () => {
      const result = service.splitCompetence(null);
      expect(result).toEqual({ competences: null, sousCompetences: null });
    });

    it("should return null for both competences and sousCompetences when input is empty array", () => {
      const result = service.splitCompetence([]);
      expect(result).toEqual({ competences: null, sousCompetences: null });
    });

    it("should correctly split single competence without sous-competence", () => {
      const result = service.splitCompetence(["Santé"]);
      expect(result).toEqual({
        competences: ["Santé"],
        sousCompetences: null,
      });
    });

    it("should correctly split single competence with sous-competence", () => {
      const result = service.splitCompetence(["Culture__Arts plastiques et photographie"]);
      expect(result).toEqual({
        competences: ["Culture"],
        sousCompetences: ["Arts plastiques et photographie"],
      });
    });

    it("should correctly split multiple competences with and without sous-competences", () => {
      const result = service.splitCompetence([
        "Santé",
        "Culture__Arts plastiques et photographie",
        "Culture__Bibliothèques et livres",
      ]);
      expect(result).toEqual({
        competences: ["Santé", "Culture"],
        sousCompetences: ["Arts plastiques et photographie", "Bibliothèques et livres"],
      });
    });
  });

  describe("combineCompetences", () => {
    it("should return null when competences is null", () => {
      const result = service.combineCompetences(null, null);
      expect(result).toBeNull();
    });

    it("should return null when competences is empty array", () => {
      const result = service.combineCompetences([], null);
      expect(result).toBeNull();
    });

    it("should return competences without sous-competences when no sous-competences are provided", () => {
      const result = service.combineCompetences(["Santé", "Sports"], null);
      expect(result).toEqual(["Santé", "Sports"]);
    });

    it("should correctly combine competences with their related sous-competences", () => {
      const result = service.combineCompetences(
        ["Culture"],
        ["Arts plastiques et photographie", "Bibliothèques et livres"],
      );
      expect(result).toEqual(["Culture__Arts plastiques et photographie", "Culture__Bibliothèques et livres"]);
    });

    it("should keep competence as is when no related sous-competence is found", () => {
      const result = service.combineCompetences(["Santé"], ["Arts plastiques et photographie"]);
      expect(result).toEqual(["Santé"]);
    });

    it("should handle mix of competences with and without related sous-competences", () => {
      const result = service.combineCompetences(["Culture", "Santé"], ["Arts plastiques et photographie"]);
      expect(result).toEqual(["Culture__Arts plastiques et photographie", "Santé"]);
    });
  });
});
