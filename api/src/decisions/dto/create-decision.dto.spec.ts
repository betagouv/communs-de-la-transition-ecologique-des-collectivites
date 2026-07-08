import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateDecisionDto, PAYLOAD_MAX_BYTES } from "./create-decision.dto";

// Validation au niveau DTO (class-validator) uniquement : enum de typeDecision,
// types d'objets, longueurs, UUID, taille du payload. Les contraintes CROISÉES par
// type (objetB/verdict/payload requis vs interdit) sont couvertes dans decision-contract.spec.ts.
const validBase = {
  typeDecision: "doublon_signale",
  objetAType: "projet",
  objetAId: "proj-a",
};

const validate = (payload: Record<string, unknown>) => {
  const dto = plainToInstance(CreateDecisionDto, payload);
  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
};

const errorsOn = (payload: Record<string, unknown>) => validate(payload).map((e) => e.property);

describe("CreateDecisionDto validation", () => {
  it("accepte un payload minimal valide", () => {
    expect(validate(validBase)).toHaveLength(0);
  });

  it("rejette typeDecision hors de l'enum fermée", () => {
    expect(errorsOn({ ...validBase, typeDecision: "lien_confirme" })).toContain("typeDecision");
    expect(errorsOn({ ...validBase, typeDecision: "doublon_signale" })).not.toContain("typeDecision");
  });

  it("rejette objetAType hors énumération", () => {
    expect(errorsOn({ ...validBase, objetAType: "cluster" })).toContain("objetAType");
  });

  it("accepte objetBType='pcaet' (réservé au rattachement)", () => {
    expect(errorsOn({ ...validBase, objetBType: "pcaet", objetBId: "200000172" })).not.toContain("objetBType");
  });

  it("rejette objetBType hors énumération (objetB)", () => {
    expect(errorsOn({ ...validBase, objetBType: "cluster" })).toContain("objetBType");
  });

  it("applique MaxLength(200) sur objetAId", () => {
    expect(errorsOn({ ...validBase, objetAId: "x".repeat(201) })).toContain("objetAId");
  });

  it("applique MaxLength(2000) sur commentaire", () => {
    expect(errorsOn({ ...validBase, commentaire: "x".repeat(2001) })).toContain("commentaire");
  });

  it("exige un UUID pour supersedes", () => {
    expect(errorsOn({ ...validBase, supersedes: "pas-un-uuid" })).toContain("supersedes");
    expect(errorsOn({ ...validBase, supersedes: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" })).not.toContain("supersedes");
  });

  it("rejette un payload sérialisé au-delà de la limite d'octets", () => {
    const big = { blob: "x".repeat(PAYLOAD_MAX_BYTES + 1) };
    expect(errorsOn({ ...validBase, payload: big })).toContain("payload");
  });

  it("accepte un payload objet sous la limite", () => {
    expect(errorsOn({ ...validBase, payload: { a: 1, b: "ok" } })).not.toContain("payload");
  });
});
