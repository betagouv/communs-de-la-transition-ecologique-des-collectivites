import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateDecisionDto, PAYLOAD_MAX_BYTES } from "./create-decision.dto";

const validBase = {
  typeDecision: "lien_confirme",
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

  it("rejette objetAType hors énumération", () => {
    expect(errorsOn({ ...validBase, objetAType: "cluster" })).toContain("objetAType");
  });

  it("applique MaxLength(100) sur typeDecision", () => {
    expect(errorsOn({ ...validBase, typeDecision: "x".repeat(101) })).toContain("typeDecision");
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
