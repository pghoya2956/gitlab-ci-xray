/**
 * Levenshtein distance between two strings.
 * Used for typo suggestions in schema validation.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Find the closest match from a set of candidates.
 * Returns null if no candidate is within maxDistance.
 */
export function findClosest(
  input: string,
  candidates: Iterable<string>,
  maxDistance = 2,
): string | null {
  let best: string | null = null;
  let bestDist = maxDistance + 1;

  for (const c of candidates) {
    // Quick length check to skip obvious non-matches
    if (Math.abs(c.length - input.length) > maxDistance) continue;
    const d = levenshtein(input, c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }

  return best;
}
