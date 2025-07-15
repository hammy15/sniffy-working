// scoring.js

/**
 * Scope maps
 * A/B/C = 1, D/E/F = 2, G/H/I = 3, J/K/L = 4
 */
const scopeMap = { A: 1, B: 1, C: 1, D: 2, E: 2, F: 2, G: 3, H: 3, I: 3, J: 4, K: 4, L: 4 };

/**
 * Severity point base values (non-SQC)
 * + SQC bonus applied for shaded cells (CMS grid)
 */
const severityBase = { A:0, B:0, C:0, D:4, E:8, F:16, G:20, H:35, I:45, J:50, K:100, L:150 };

// SQC: Applies extra points when F/H/I/J/K/L fall under SQC tags
const SQC_EXTRA = { F:4, H:5, I:5, J:25, K:25, L:25 };

/**
 * F-tags considered SQC under CMS
 * Includes ranges: F221-F226, F240-F258, F309-F334 etc.
 * For brevity, simplified array
 */
const sqcTags = [
  ...range(221, 226),
  ...range(240, 258),
  ...range(309, 334),
  684, 685, 699 // Quality-of-care SQC examples :contentReference[oaicite:1]{index=1}
].map(n => `F${n}`);

// Utility to generate numeric range
function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/**
 * Calculates deficiency point for a single tag entry
 * @param {string} tag - e.g. 'F684'
 * @param {string} scopeSeverity - one-letter A-L
 */
export function calcDeficiencyPoints(tag, scopeSeverity) {
  const ss = scopeSeverity.toUpperCase();
  const base = severityBase[ss];
  if (base == null) throw new Error(`Invalid severity code: ${ss}`);
  let total = base;

  // Add SQC bonus if applicable
  if (['F','H','I','J','K','L'].includes(ss) && sqcTags.includes(tag)) {
    total += SQC_EXTRA[ss] || 0;
  }
  return total;
}

/**
 * Calculates revisit penalty points
 * @param {number} revisitCount - 0–4
 */
export function calcRevisitPenalty(points, revisitCount) {
  if (revisitCount <= 1) return 0;
  const penalties = [0, 0, 0.5, 0.7, 0.85];
  return Math.ceil(points * penalties[revisitCount] - points);
}

/**
 * Weighting survey cycles: latest, previous, older
 */
export const cycleWeight = [0.5, 1/3, 1/6];
