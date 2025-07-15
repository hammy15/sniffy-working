// scoring.js

// CMS Scope-Severity base points (non-substandard quality)
const basePoints = {
  A: 0, B: 0, C: 0,
  D: 4, E: 8, F: 16,
  G: 20, H: 35, I: 45,
  J: 50, K: 100, L: 150,
};

// CMS scope-severity chart for reference (optional)
const severityGrid = {
  immediateJeopardy: ['J','K','L'],
  actualHarm: ['G','H','I'],
  potentialMoreThanMinimal: ['D','E','F'],
};

/**
 * Calculate points from a single tag.
 * @param {string} tag - e.g. 'F684'
 * @param {string} severity - 'F', 'G', etc.
 * @param {boolean} substandard - whether tag is under SQC categories (per CMS shading).
 * @returns {number} points
 */
export function scoreTag(severity, substandard = false) {
  let pts = basePoints[severity] || 0;
  if (substandard && pts > 0) {
    pts = Math.ceil(pts * 1.25); // +25% for SQC
  }
  return pts;
}

/**
 * Score all deficiencies in a survey cycle.
 * @param {Array<{tag:string, severity:string, substandard:boolean}>} findings
 * @returns {number} total points
 */
export function scoreCycle(findings) {
  return findings.reduce((sum, f) => sum + scoreTag(f.severity, f.substandard), 0);
}

/**
 * Calculate weighted score across up to 3 cycles:
 * Cycle1: 50%, Cycle2: 33.33%, Cycle3: 16.67%
 * @param {number[]} cycleScores
 * @returns {number}
 */
export function weightedSurveyScore(cycleScores = []) {
  const weights = [0.5, 0.3333, 0.1667];
  return cycleScores
    .slice(0, 3)
    .reduce((sum, score, idx) => sum + (score * (weights[idx] || 0)), 0);
}

/**
 * Compute final facility score including complaint cycles and revisits.
 * For simplicity: sum weighted survey + complaint + revisitScore.
 * RevisitScore logic to be handled separately.
 */
export function finalFacilityScore({ surveyCycles, complaintCycles = [], revisitScore = 0 }) {
  const surveyWtd = weightedSurveyScore(surveyCycles);
  const compWtd = weightedSurveyScore(complaintCycles);
  return surveyWtd + compWtd + revisitScore;
}
