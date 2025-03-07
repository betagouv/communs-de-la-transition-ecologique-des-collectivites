import { getFormattedDate } from "@test/helpers/get-formatted-date";
import { CreateProjetRequest } from "@projets/dto/create-projet.dto";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";

export const mockedDefaultCollectivite: CollectiviteReference = { type: "Commune", code: "01001" };

export const mockProjetPayload = (specificPayload: Partial<CreateProjetRequest> = {}): CreateProjetRequest => ({
  nom: specificPayload.nom ?? "Test Project",
  description: specificPayload.description ?? "Test Description",
  budgetPrevisionnel: specificPayload.budgetPrevisionnel ?? 100000,
  dateDebutPrevisionnelle: specificPayload.dateDebutPrevisionnelle ?? getFormattedDate(),
  status: specificPayload.status ?? "IDEE",
  collectivites: specificPayload.collectivites ?? [mockedDefaultCollectivite],
  competences: specificPayload.competences ?? ["Santé", "Culture > Arts plastiques et photographie"],
  leviers: ["Bio-carburants"],
  externalId: specificPayload.externalId ?? "test-external-id",
});
