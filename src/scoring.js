// scoring.js

/**
 * Scope‑Severity to base points per CMS Five‑Star / SFF methodology :contentReference[oaicite:1]{index=1}
 */
const SCOPE_SEVERITY_POINTS = {
  A: 0, B: 0, C: 0,
  D: 4, E: 8, F: 16,
  G: 20, H: 35, I: 45,
  J: 50, K: 100, L: 150
};

// Additional substandard quality-of-care (SQC) points (optional)
const SQC_EXTRA = {
  E: 0, F: 4,
  G: 0, H: 5, I: 5,
  J: 25, K: 25, L: 25
};

/**
 * Revisit penalty percentages :contentReference[oaicite:2]{index=2}
 */
const REVISIT_MULTIPLIERS = {
  1: 0,
  2: 0.5,
  3: 0.7,
  4: 0.85
};

// Example state cut points (these must be updated from CMS tables)  
// Format: state code => { stars: [upper5, upper4, upper3, upper2, upper1] }
const STATE_CUTPOINTS = {
  // e.g., 'WA': [3.2, 6.5, 10.1, 14.8, Infinity],
  // You need to populate this from CMS 2025 cut-point tables :contentReference[oaicite:3]{index=3}
};

/**
 * Calculates total deficiency points for a set of findings
 * Each finding: { tag: 'F684', scope: 'A'...'L', severity: 'A'...'L' }
 */
export function calculateDeficiencyScore(findings = []) {
  let total = 0;
  for (const f of findings) {
    const key = f.severity;
    const pts = SCOPE_SEVERITY_POINTS[key] || 0;
    const extra = SQC_EXTRA[key] || 0;
    total += pts + extra;
  }
  return total;
}

/**
 * Applies revisit penalties to a base cycle score
 */
export function applyRevisitPenalty(cycleScore, revisitCount = 1) {
  const multiplier = REVISIT_MULTIPLIERS[revisitCount] ?? 0;
  return cycleScore * (1 + multiplier);
}

/**
 * Computes weighted score across 3 survey cycles
 * cyclingScores: [mostRecent, prev, earliest]
 */
export function weightedSurveyScore(cycleScores = [0,0,0]) {
  const weights = [0.5, 1/3, 1/6];
  return cycleScores.reduce((sum, score, i) => sum + (score * weights[i]), 0);
}

/**
 * Determines star rating given survey score and state
 */
export function determineStarRating(score, stateCode) {
  const cps = STATE_CUTPOINTS[stateCode];
  if (!cps) return null;
  for (let i = 0; i < cps.length; i++) {
    if (score <= cps[i]) {
      return 5 - i;
    }
  }
  return 1;
}
