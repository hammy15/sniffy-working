// scoring.js
/**
 * Calculates CMS deficiency score using scope & severity grid.
 * substandard tags get higher points per CMS methodology :contentReference[oaicite:1]{index=1}
 *
 * scope: 'A'–'L', severity-coded per CMS
 * substandard: boolean indicating substandard quality of care tag
 */

const GRID_POINTS = {
  // Not substandard: points
  standard: {
    A: 0, B: 0, C: 0,
    D: 2, E: 4, F: 6,
    G: 10, H: 20, I: 30,
    J: 50, K: 100, L: 150
  },
  // Substandard: increased points in shaded cells
  substandard: {
    A: 0, B: 0, C: 0,
    D: 2, E: 4, F: 10,  // F-level bump from 6 → 10
    G: 10, H: 25, I: 35,
    J: 75, K: 125, L: 175
  }
};

export function calculateScore(deficiencies) {
  // deficiencies: array of { tag: 'F684', scopeSeverity: 'E', isSubstandard: true|false }
  let total = 0;
  const breakdown = [];

  for (const d of deficiencies) {
    const { scopeSeverity, isSubstandard } = d;
    const map = isSubstandard ? GRID_POINTS.substandard : GRID_POINTS.standard;
    const points = map[scopeSeverity] ?? 0;
    total += points;
    breakdown.push({ ...d, points });
  }

  return { total, breakdown };
}
import { calculateScore } from './scoring';

const deficiencies = [
  { tag: 'F684', scopeSeverity: 'E', isSubstandard: false },
  { tag: 'F689', scopeSeverity: 'F', isSubstandard: true }, // substandard upgrade
  { tag: 'F880', scopeSeverity: 'L', isSubstandard: false }
];

const scoreResult = calculateScore(deficiencies);
console.log(scoreResult.total); // aggregated points
console.table(scoreResult.breakdown);
