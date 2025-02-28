import { CreateProjectRequest } from "@projects/dto/create-project.dto";
import { getFormattedDate } from "@test/helpers/get-formatted-date";
import { CollectiviteReference } from "@projects/dto/collectivite.dto";

export const mockedDefaultCollectivites: CollectiviteReference[] = [{ type: "Commune", code: "01001" }];
export const mockedDefaultCommunes = ["01001", "75056", "97A01"];

export const mockProjectPayload = (specificPayload: Partial<CreateProjectRequest> = {}): CreateProjectRequest => ({
  nom: specificPayload.nom ?? "Test Project",
  description: specificPayload.description ?? "Test Description",
  budget: specificPayload.budget ?? 100000,
  forecastedStartDate: specificPayload.forecastedStartDate ?? getFormattedDate(),
  status: specificPayload.status ?? "IDEE",
  communeInseeCodes: specificPayload.communeInseeCodes ?? mockedDefaultCommunes,
  collectivitesRef: specificPayload.collectivitesRef ?? mockedDefaultCollectivites,
  competences: specificPayload.competences ?? ["Santé", "Culture > Arts plastiques et photographie"],
  leviers: ["Bio-carburants"],
  externalId: specificPayload.externalId ?? "test-external-id",
});
