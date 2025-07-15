// scoring.js

/**
 * Maps scope (I, P, W) and severity (A–L) codes to base points and substandard care flag.
 */
const scopeSeverityGrid = {
  A: { I: 0, P: 0, W: 0 },
  B: { I: 0, P: 0, W: 0 },
  C: { I: 0, P: 0, W: 0 },
  D: { I: 2, P: 4, W: 6 },
  E: { I: 2, P: 4, W: 6 },
  F: { I: 6, P: 10, W: 16 },
  G: { I: 10, P: 20, W: 30 },
  H: { I: 10, P: 20, W: 30 },
  I: { I: 10, P: 20, W: 30 },
  J: { I: 50, P: 100, W: 150 },
  K: { I: 50, P: 100, W: 150 },
  L: { I: 50, P: 100, W: 150 },
};

// Shaded cells denote substandard-quality-of-care: F, H, I, J, K, L. F‑severity may add extra points.
const substandardTags = new Set(['F', 'H', 'I', 'J', 'K', 'L']);

/**
 * Returns the score and substandard flag for a single deficiency.
 * @param {string} severity - Letter A–L.
 * @param {string} scope - 'I', 'P', or 'W'.
 */
export function scoreTag(severity, scope) {
  const upperSeverity = severity.toUpperCase();
  const upperScope = scope.toUpperCase();
  if (!scopeSeverityGrid[upperSeverity]?.[upperScope]?.toString()) {
    return { points: 0, isSubstandard: false };
  }
  const points = scopeSeverityGrid[upperSeverity][upperScope];
  const isSubstandard = substandardTags.has(upperSeverity);
  return { points, isSubstandard };
}

/**
 * Calculates total deficiency score for a set of tags.
 * @param {Array<{severity: string, scope: string}>} deficiencies
 */
export function totalDeficiencyScore(deficiencies) {
  return deficiencies.reduce((sum, d) => {
    const { points } = scoreTag(d.severity, d.scope);
    return sum + points;
  }, 0);
}

/**
 * Adds revisit points based on number of revisits.
 * Per CMS: 0 for first, +50, +75, +100 cumulative.
 * @param {number} revisitCount
 */
export function revisitScore(revisitCount) {
  if (revisitCount <= 1) return 0;
  if (revisitCount === 2) return 50;
  if (revisitCount === 3) return 125; // 50 + 75
  if (revisitCount >= 4) return 225; // 50 + 75 + 100
  return 0;
}

/**
 * Weighting function for survey cycles.
 * Most recent=1, second=2/3, third=1/3.
 */
function periodWeight(idx) {
  return idx === 0 ? 1 : idx === 1 ? 2/3 : idx === 2 ? 1/3 : 0;
}

/**
 * Calculates final weighted SFF score based on up to 3 survey periods.
 *
 * Each period contains:
 * { deficiencies: [...], revisitCount: number }
 *
 * Returns rounded integer.
 */
export function computeSFFScore(periods = []) {
  const scores = periods.slice(0, 3).map((p, idx) => {
    const defScore = totalDeficiencyScore(p.deficiencies);
    const revScore = revisitScore(p.revisitCount);
    const periodTotal = defScore + revScore;
    const weight = periodWeight(idx);
    return periodTotal * weight;
  });
  const weightedSum = scores.reduce((a, b) => a + b, 0);
  return Math.round(weightedSum * 3);
}
