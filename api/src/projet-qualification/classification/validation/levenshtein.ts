/**
 * Calculate Levenshtein distance between two strings
 * Uses standard dynamic programming implementation
 * Compares lowercase versions for case-insensitive matching
 */
export function levenshteinDistance(a: string, b: string): number {
  const normalizedA = a.toLowerCase();
  const normalizedB = b.toLowerCase();

  const m = normalizedA.length;
  const n = normalizedB.length;

  // Create matrix of size (m+1) x (n+1)
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  // Initialize first column and first row
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = normalizedA[i - 1] === normalizedB[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Find the closest match from a list of candidates
 * Returns the match and its distance, or null if no match within threshold
 */
export function findClosestMatch(
  input: string,
  candidates: readonly string[],
  maxDistance = 3,
): { match: string; distance: number } | null {
  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(input, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  if (bestMatch !== null && bestDistance <= maxDistance) {
    return { match: bestMatch, distance: bestDistance };
  }

  return null;
}
