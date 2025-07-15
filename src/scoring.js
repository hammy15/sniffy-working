// scoring.js
/**
 * Scoring logic based on CMS Scope & Severity grid:
 *   Scope: A=Isolated, B=Pattern, C=Widespread (columns)
 *   Severity: 1–4 (rows, A/B/C=1; D/E/F=2; G/H/I=3; J/K/L=4)
 *   Points based on grid:
 *     - No Actual Harm: A/B/C = 0
 *     - Potential>Minimal: D=2, E=4, F=6
 *     - Actual Harm: G=10, H=20, I=30
 *     - Immediate Jeopardy: J=50, K=100, L=150
 */
const scopeMap = { A: 1, B: 2, C: 3 };
const severityMap = {
  A: 1, B: 1, C: 1,
  D: 2, E: 2, F: 2,
  G: 3, H: 3, I: 3,
  J: 4, K: 4, L: 4
};
const pointsGrid = {
  1: { 1: 0, 2: 0, 3: 0 },
  2: { 1: 2, 2: 4, 3: 6 },
  3: { 1: 10, 2: 20, 3: 30 },
  4: { 1: 50, 2: 100, 3: 150 }
};

/**
 * @param {string} tag e.g. 'F684'
 * @param {string} ss e.g. 'D3' or 'G1' from the 2567 SS=
 * @returns {object} { scope, severity, points }
 */
export function scoreSS(ssCode = '') {
  const letter = ssCode.trim().charAt(0).toUpperCase();
  const scopeLetter = ssCode.trim().slice(-1).toUpperCase();
  if (!severityMap[letter] || !scopeMap[scopeLetter]) {
    return { scope: null, severity: null, points: null };
  }
  const sev = severityMap[letter];
  const sc = scopeMap[scopeLetter];
  const pts = pointsGrid[sev][sc] || 0;
  return { scope: sc, severity: sev, points: pts };
}

/**
 * Totals score for multiple tag-SS pairs.
 * @param {Array<{ tag: string, ss: string }>} items
 * @returns {object} { totalPoints, breakdown: [...], count }
 */
export function scoreBatch(items = []) {
  const breakdown = items.map(item => {
    const sc = scoreSS(item.ss);
    return { ...item, ...sc };
  }).filter(b => b.points != null);

  const totalPoints = breakdown.reduce((sum, b) => sum + b.points, 0);
  return { totalPoints, breakdown, count: breakdown.length };
}
