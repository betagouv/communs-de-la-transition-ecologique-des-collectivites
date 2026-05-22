import { AidesMatchingService } from "./aides-matching.service";
import { CustomLogger } from "@logging/logger.service";

describe("AidesMatchingService", () => {
  let service: AidesMatchingService;

  beforeEach(() => {
    const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as CustomLogger;
    service = new AidesMatchingService(mockLogger);
  });

  const makeScores = (
    th: { label: string; score: number }[] = [],
    si: { label: string; score: number }[] = [],
    int: { label: string; score: number }[] = [],
  ) => ({ thematiques: th, sites: si, interventions: int });

  describe("match", () => {
    it("should return matching aides sorted by score with normalizedScore and axesMatched", () => {
      const projet = makeScores(
        [
          { label: "Energies renouvelables", score: 0.9 },
          { label: "Sobriété énergétique", score: 0.85 },
        ],
        [{ label: "Bâtiment public", score: 0.9 }],
        [{ label: "Rénovation bâtiment", score: 0.95 }],
      );

      const aides = new Map([
        [
          "aide-1",
          makeScores(
            [{ label: "Energies renouvelables", score: 0.95 }],
            [{ label: "Bâtiment public", score: 0.85 }],
            [{ label: "Rénovation bâtiment", score: 0.9 }],
          ),
        ],
        [
          "aide-2",
          makeScores([{ label: "Sobriété énergétique", score: 0.8 }], [], [{ label: "Etude/Diagnostic", score: 0.9 }]),
        ],
        ["aide-3", makeScores([{ label: "Tourisme", score: 0.9 }], [], [])],
      ]);

      const results = service.match(projet, aides);

      // aide-1 should score highest (matches on all 3 axes)
      expect(results[0].idAt).toBe("aide-1");
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].normalizedScore).toBeGreaterThan(0);
      expect(results[0].normalizedScore).toBeLessThanOrEqual(1);
      expect(results[0].axesMatched).toBe(3);

      // aide-2 should match on thematiques only (1 axis)
      const aide2 = results.find((r) => r.idAt === "aide-2");
      expect(aide2).toBeDefined();
      expect(aide2!.axesMatched).toBe(1);
      expect(aide2!.normalizedScore).toBeLessThan(results[0].normalizedScore);

      // aide-3 should not match (no common labels)
      expect(results.find((r) => r.idAt === "aide-3")).toBeUndefined();
    });

    it("should filter labels below threshold (0.8)", () => {
      const projet = makeScores([{ label: "Energies renouvelables", score: 0.5 }]); // below 0.8

      const aides = new Map([["aide-1", makeScores([{ label: "Energies renouvelables", score: 0.9 }])]]);

      const results = service.match(projet, aides);

      // No match because project label is below threshold
      expect(results).toHaveLength(0);
    });

    it("should respect limit parameter", () => {
      const projet = makeScores([{ label: "Energies renouvelables", score: 0.9 }]);

      const aides = new Map(
        Array.from({ length: 20 }, (_, i) => [
          `aide-${i}`,
          makeScores([{ label: "Energies renouvelables", score: 0.8 + i * 0.005 }]),
        ]),
      );

      const results = service.match(projet, aides, 5);
      expect(results).toHaveLength(5);
    });

    it("should calculate score matching Gaëtan formula", () => {
      // Manual calculation: (0.9 - 0.7) * (0.85 - 0.7) / 1 = 0.2 * 0.15 = 0.03
      const projet = makeScores([{ label: "Test", score: 0.9 }]);
      const aides = new Map([["aide-1", makeScores([{ label: "Test", score: 0.85 }])]]);

      const results = service.match(projet, aides);
      expect(results[0].scoreThematiques).toBeCloseTo(0.03, 2);
    });

    it("should compute normalizedScore as score / projectMax", () => {
      // 1 label on 1 axis: project max = (0.9 - 0.7) * 0.3 / 1 = 0.06
      // Aide matches at 1.0: score = (0.9 - 0.7) * (1.0 - 0.7) / 1 = 0.06
      // normalizedScore = 0.06 / 0.06 = 1.0
      const projet = makeScores([{ label: "Test", score: 0.9 }]);
      const aides = new Map([["aide-1", makeScores([{ label: "Test", score: 1.0 }])]]);

      const results = service.match(projet, aides);
      expect(results[0].normalizedScore).toBeCloseTo(1.0, 2);
    });

    it("should return normalizedScore < 1 for partial matches", () => {
      // Project: 2 labels on thematiques. Aide matches only 1.
      // projectMax(thematiques) = ((0.9-0.7)*0.3 + (0.85-0.7)*0.3) / 2 = (0.06 + 0.045) / 2 = 0.0525
      // score(thematiques) = (0.9-0.7)*(0.9-0.7) / 2 = 0.04 / 2 = 0.02
      // normalizedScore = 0.02 / 0.0525 ≈ 0.38
      const projet = makeScores([
        { label: "A", score: 0.9 },
        { label: "B", score: 0.85 },
      ]);
      const aides = new Map([["aide-1", makeScores([{ label: "A", score: 0.9 }])]]);

      const results = service.match(projet, aides);
      expect(results[0].normalizedScore).toBeCloseTo(0.38, 1);
      expect(results[0].normalizedScore).toBeLessThan(1);
    });

    it("should return common labels", () => {
      const projet = makeScores(
        [
          { label: "A", score: 0.9 },
          { label: "B", score: 0.85 },
        ],
        [],
        [],
      );

      const aides = new Map([["aide-1", makeScores([{ label: "A", score: 0.9 }])]]);

      const results = service.match(projet, aides);
      expect(results[0].labelsCommuns.thematiques).toEqual(["A"]);
    });

    it("should weight axes 45% thématiques / 35% sites / 20% interventions", () => {
      // Project has one label per axis, all at the same confidence (0.9).
      // Each aide is a perfect match (1.0) on exactly one axis, so its
      // normalizedScore reflects that axis' relative weight.
      const projet = makeScores(
        [{ label: "Th", score: 0.9 }],
        [{ label: "Si", score: 0.9 }],
        [{ label: "In", score: 0.9 }],
      );

      const aides = new Map([
        ["aide-th", makeScores([{ label: "Th", score: 1.0 }], [], [])],
        ["aide-si", makeScores([], [{ label: "Si", score: 1.0 }], [])],
        ["aide-in", makeScores([], [], [{ label: "In", score: 1.0 }])],
      ]);

      const results = service.match(projet, aides);
      const byId = (id: string) => results.find((r) => r.idAt === id)!;

      expect(byId("aide-th").normalizedScore).toBeCloseTo(0.45, 2);
      expect(byId("aide-si").normalizedScore).toBeCloseTo(0.35, 2);
      expect(byId("aide-in").normalizedScore).toBeCloseTo(0.2, 2);
    });

    it("should handle empty inputs", () => {
      expect(service.match(makeScores(), new Map())).toEqual([]);
    });
  });

  describe("match — custom thresholds", () => {
    it("includes a project label below 0.8 when projetThreshold is lowered", () => {
      const projet = makeScores([{ label: "Energies renouvelables", score: 0.65 }]);
      const aides = new Map([["aide-1", makeScores([{ label: "Energies renouvelables", score: 0.9 }])]]);

      // Default (0.8) : le label projet à 0.65 est filtré → aucun match.
      expect(service.match(projet, aides)).toHaveLength(0);

      // projetThreshold abaissé à 0.6 : le label passe → match.
      const results = service.match(projet, aides, 10, { projet: 0.6 });
      expect(results).toHaveLength(1);
      expect(results[0].idAt).toBe("aide-1");
    });

    it("includes an aide label below 0.8 when aideThreshold is lowered", () => {
      const projet = makeScores([{ label: "Sobriété énergétique", score: 0.9 }]);
      const aides = new Map([["aide-1", makeScores([{ label: "Sobriété énergétique", score: 0.55 }])]]);

      expect(service.match(projet, aides)).toHaveLength(0);

      const results = service.match(projet, aides, 10, { aide: 0.5 });
      expect(results).toHaveLength(1);
      expect(results[0].idAt).toBe("aide-1");
    });

    it("keeps thresholds independent for the project and aide sides", () => {
      // Label projet à 0.9 (OK au défaut), label aide à 0.6 (sous le défaut).
      const projet = makeScores([{ label: "Test", score: 0.9 }]);
      const aides = new Map([["aide-1", makeScores([{ label: "Test", score: 0.6 }])]]);

      // Abaisser seulement le seuil projet ne suffit pas — le label aide reste filtré.
      expect(service.match(projet, aides, 10, { projet: 0.5 })).toHaveLength(0);
      // Abaisser le seuil aide débloque le match.
      expect(service.match(projet, aides, 10, { aide: 0.5 })).toHaveLength(1);
    });
  });
});
