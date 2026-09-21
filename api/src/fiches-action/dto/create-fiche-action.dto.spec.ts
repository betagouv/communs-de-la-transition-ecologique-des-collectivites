import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateFicheActionRequest } from "./create-fiche-action.dto";

// Reproduit la validation globale (setup-app.ts) : whitelist + forbidNonWhitelisted.
const validate = (payload: unknown) =>
  validateSync(plainToInstance(CreateFicheActionRequest, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

// Aplati les messages d'erreur (y compris les enfants imbriqués comme collectivites[].xxx).
const messages = (errs: ReturnType<typeof validate>): string[] =>
  errs.flatMap((e) => [
    ...Object.values(e.constraints ?? {}),
    ...(e.children ?? []).flatMap((c) => [
      ...Object.values(c.constraints ?? {}),
      ...(c.children ?? []).flatMap((g) => Object.values(g.constraints ?? {})),
    ]),
  ]);

const base = {
  nom: "Fiche test",
  externalId: "144374",
  plans: [{ externalId: "6819", nom: "SCHEMA DIRECTEUR CYCLABLE", type: "Plan Mobilité" }],
};

describe("CreateFicheActionRequest — collectivites validation", () => {
  it("accepte une collectivité avec collectiviteId TeT (issue deep-link, webhook TeT prod)", () => {
    // Régression : TeT a ajouté collectiviteId au payload → 400 « property collectiviteId should not exist »
    // à cause de forbidNonWhitelisted. On doit l'accepter.
    const errs = validate({
      ...base,
      collectivites: [{ type: "EPCI", code: "200023778", collectiviteId: "4936" }],
    });
    expect(messages(errs)).not.toContain("property collectiviteId should not exist");
    expect(errs).toHaveLength(0);
  });

  it("reste valide sans collectiviteId (rétrocompat)", () => {
    const errs = validate({ ...base, collectivites: [{ type: "EPCI", code: "200023778" }] });
    expect(errs).toHaveLength(0);
  });

  it("rejette toujours un champ collectivité vraiment inconnu", () => {
    const errs = validate({
      ...base,
      collectivites: [{ type: "EPCI", code: "200023778", champInvente: "x" }],
    });
    expect(messages(errs)).toContain("property champInvente should not exist");
  });
});
