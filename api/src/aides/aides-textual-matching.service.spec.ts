import { AidesTextualMatchingService, normalizeText } from "./aides-textual-matching.service";
import { Aide } from "./dto/aides.dto";

function makeAide(id: number, fields: Partial<Aide> = {}): Aide {
  return {
    id,
    slug: `aide-${id}`,
    url: `/aides/${id}/`,
    name: `Aide ${id}`,
    name_initial: `Aide ${id}`,
    short_title: null,
    financers: [],
    financers_full: [],
    instructors: [],
    programs: [],
    description: null,
    eligibility: null,
    perimeter: "France",
    perimeter_id: 1,
    perimeter_scale: "country",
    categories: [],
    targeted_audiences: [],
    aid_types: [],
    aid_types_full: [],
    mobilization_steps: [],
    origin_url: null,
    application_url: null,
    is_call_for_project: false,
    start_date: null,
    submission_deadline: null,
    subvention_rate_lower_bound: null,
    subvention_rate_upper_bound: null,
    subvention_comment: null,
    contact: null,
    recurrence: null,
    project_examples: null,
    date_created: null,
    date_updated: null,
    ...fields,
  };
}

describe("normalizeText", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeText("Rénovation ÉNERGÉTIQUE")).toEqual(["renovation", "energetique"]);
  });

  it("drops tokens shorter than 3 characters", () => {
    expect(normalizeText("un to abc défg")).toEqual(["abc", "defg"]);
  });

  it("removes French stopwords (accent-insensitive)", () => {
    // "à", "des", "pour" sont des stopwords ; "écoles" reste
    expect(normalizeText("à des écoles pour tous")).toEqual(["ecoles"]);
  });

  it("splits on punctuation and digits", () => {
    expect(normalizeText("photovoltaïque, 2024 : panneaux-solaires")).toEqual([
      "photovoltaique",
      "panneaux",
      "solaires",
    ]);
  });
});

describe("AidesTextualMatchingService", () => {
  let service: AidesTextualMatchingService;

  beforeEach(() => {
    service = new AidesTextualMatchingService();
  });

  it("returns an empty map for an empty corpus", () => {
    expect(service.score("rénovation énergétique", []).size).toBe(0);
  });

  it("scores every aide at 0 when the query has no usable token", () => {
    const aides = [makeAide(1, { name: "Rénovation énergétique" }), makeAide(2)];
    const result = service.score("le la des", aides); // que des stopwords
    expect(result.get("1")?.score).toBe(0);
    expect(result.get("2")?.score).toBe(0);
  });

  it("ranks the aide that shares vocabulary with the project highest", () => {
    const aides = [
      makeAide(1, { name: "Rénovation énergétique des bâtiments scolaires" }),
      makeAide(2, { name: "Aide à la voirie communale" }),
      makeAide(3, { name: "Subvention pour la signalétique routière" }),
    ];
    const result = service.score("rénovation énergétique d'une école", aides);

    expect(result.get("1")!.score).toBeGreaterThan(result.get("2")!.score);
    expect(result.get("1")!.score).toBeGreaterThan(result.get("3")!.score);
    expect(result.get("1")!.matchedTerms).toEqual(expect.arrayContaining(["renovation", "energetique"]));
  });

  it("keeps all scores within [0, 1]", () => {
    const aides = [
      makeAide(1, { name: "rénovation rénovation rénovation énergétique énergétique" }),
      makeAide(2, { name: "voirie" }),
    ];
    for (const m of service.score("rénovation énergétique", aides).values()) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores an aide with zero vocabulary overlap at 0", () => {
    const aides = [makeAide(1, { name: "Aide à la voirie communale" })];
    const result = service.score("rénovation énergétique gymnase", aides);
    expect(result.get("1")!.score).toBe(0);
    expect(result.get("1")!.matchedTerms).toEqual([]);
  });

  it("aggregates text across name, description, eligibility and categories", () => {
    const aides = [
      makeAide(1, { name: "Subvention", description: "Pour la rénovation thermique des écoles" }),
      makeAide(2, { name: "Subvention", categories: ["mobilité douce"] }),
    ];
    const result = service.score("rénovation thermique", aides);
    expect(result.get("1")!.score).toBeGreaterThan(result.get("2")!.score);
  });
});
