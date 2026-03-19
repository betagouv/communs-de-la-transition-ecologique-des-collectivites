import { levenshteinDistance, findClosestMatch } from "./levenshtein";

describe("levenshteinDistance", () => {
  it("should return 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("should be case-insensitive", () => {
    expect(levenshteinDistance("Hello", "hello")).toBe(0);
  });

  it("should handle accent differences", () => {
    // "Energie éolienne" vs "Energie eolienne" → distance 1
    expect(levenshteinDistance("Energie éolienne", "Energie eolienne")).toBe(1);
  });

  it("should calculate correct distance for substitutions", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });

  it("should handle empty strings", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });
});

describe("findClosestMatch", () => {
  const candidates = ["Energies renouvelables", "Sobriété énergétique", "Isolation thermique", "Gestion des déchets"];

  it("should find exact match with distance 0", () => {
    const result = findClosestMatch("Energies renouvelables", candidates);
    expect(result).toEqual({ match: "Energies renouvelables", distance: 0 });
  });

  it("should find close match within default threshold", () => {
    // Typo: "Energies renouvlables" (missing 'e')
    const result = findClosestMatch("Energies renouvlables", candidates);
    expect(result).not.toBeNull();
    expect(result!.match).toBe("Energies renouvelables");
    expect(result!.distance).toBeLessThanOrEqual(3);
  });

  it("should return null when no match within threshold", () => {
    const result = findClosestMatch("Completely different text", candidates);
    expect(result).toBeNull();
  });

  it("should respect custom maxDistance", () => {
    const result = findClosestMatch("Energies renouvlables", candidates, 0);
    expect(result).toBeNull(); // Distance 1, but threshold 0
  });

  it("should find the closest match among multiple candidates", () => {
    // "Isolation thermque" is closer to "Isolation thermique" than others
    const result = findClosestMatch("Isolation thermque", candidates);
    expect(result).not.toBeNull();
    expect(result!.match).toBe("Isolation thermique");
  });
});
