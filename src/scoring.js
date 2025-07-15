// scoring.js
// Calculates deficiency and revisit scores per CMS methodology
// Includes weighted average across three time periods

// Scope-Severity lookup
const GRID = {
  A: 0, B: 0, C: 0,
  D: 4, E: 8, F: 16,     // no-harm, > minimal
  G: 20, H: 35, I: 45,   // actual harm
  J: 50, K: 100, L: 150  // immediate jeopardy
};

// Returns points for a single deficiency code letter
export function deficiencyPoints(letter, isSubstandard = false) {
  let pts = GRID[letter] || 0;
  if (isSubstandard) {
    // Add substandard premium: e.g. F becomes 20 instead of 16, etc.
    const SUB = { F:4, I:5, L:25 };
    pts += SUB[letter] || 0;
  }
  return pts;
}

// Add revisit points: second (50%), third (70%), fourth+ (85%)
export function revisitPoints(baseScore, revisitCount) {
  if (revisitCount <= 1) return 0;
  if (revisitCount === 2) return baseScore * 0.5;
  if (revisitCount === 3) return baseScore * 0.7;
  return baseScore * 0.85;
}

// Weight scores: periods = [most recent, previous, second prior]
export function weightedScore(periodScores = []) {
  const weights = [0.5, 0.333333, 0.166667];
  return periodScores
    .slice(0,3)
    .reduce((sum, s, i) => sum + (s * (weights[i] || 0)), 0);
}
import { deficiencyPoints, revisitPoints, weightedScore } from './scoring';

export default async function handler(req, res) {
  const { deficienciesByPeriod, revisitCounts } = req.body;
  // Example structure:
  // deficienciesByPeriod: [{codes:['F','J'], subFlags:[false,true]}, ...]
  // revisitCounts: [1,2,1]

  const periodScores = deficienciesByPeriod.map((list, idx) => {
    const sumDef = list.codes.reduce((sum, ltr, i) =>
      sum + deficiencyPoints(ltr, list.subFlags[i]), 0);
    const sumRevisit = revisitPoints(sumDef, revisitCounts[idx]);
    return sumDef + sumRevisit;
  });

  const totalScore = weightedScore(periodScores);
  // ... use totalScore in POC logic, GPT prompt context
  
  res.status(200).json({ totalScore });
}
