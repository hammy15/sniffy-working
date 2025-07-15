// scoring.js

// Scoring per CMS scope-severity grid (non‑SQC / SQC additional)
const baseScore = {
  A: 0, B: 0, C: 0,
  D: 4, E: 8, F: 16,
  G: 20, H: 35, I: 45,
  J: 50, K: 100, L: 150
};

const sqcBonus = {
  F: 4, H: 5, I: 5, J: 25, K: 25, L: 25
};

/**
 * Compute points per deficiency.
 * @param {string} tagCode - e.g., "F Tag 689"
 * @param {string} scopeSeverity - letter A–L
 * @param {boolean} isSQC - if it's substandard quality of care
 */
export function scoreDeficiency(scopeSeverity, isSQC = false) {
  let pts = baseScore[scopeSeverity] || 0;
  if (isSQC && sqcBonus[scopeSeverity]) {
    pts += sqcBonus[scopeSeverity];
  }
  return pts;
}

/**
 * Sum array of deficiencies.
 * @param {array} deficiencies - [{ scope: "L", isSQC: true }, ...]
 */
export function totalScore(deficiencies = []) {
  return deficiencies.reduce((sum, d) => sum + scoreDeficiency(d.scope, d.isSQC), 0);
}
