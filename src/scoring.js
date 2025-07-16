// scoring.js

/**
 * Points lookup for Scope–Severity codes per CMS SFF methodology.
 * Normal values and SQC (higher) in parentheses.
 * Based on CMS Table 1: scope/severity grid :contentReference[oaicite:6]{index=6}
 */
const POINTS = {
  A: { normal: 0, sqc: 0 },
  B: { normal: 0, sqc: 0 },
  C: { normal: 0, sqc: 0 },
  D: { normal: 2, sqc: 2 },
  E: { normal: 4, sqc: 4 },
  F: { normal: 6, sqc: 10 },     // SQC increases points :contentReference[oaicite:7]{index=7}
  G: { normal: 10, sqc: 10 },
  H: { normal: 20, sqc: 25 },    // plus SQC :contentReference[oaicite:8]{index=8}
  I: { normal: 30, sqc: 35 },
  J: { normal: 50, sqc: 75 },
  K: { normal: 100, sqc: 125 },
  L: { normal: 150, sqc: 175 },
};

/**
 * Retrieve points for a single deficiency code.
 * @param {string} code - Single letter A–L scope/severity.
 * @param {boolean} isSQC - True if deficiency is Substandard Quality of Care.
 * @returns {number}
 */
export function getDeficiencyPoints(code, isSQC = false) {
  const entry = POINTS[code];
  if (!entry) {
    console.warn(`Unknown code '${code}' in scoring`);
    return 0;
  }
  return isSQC ? entry.sqc : entry.normal;
}

/**
 * Applies CMS revisit penalties: additional survey revisits add points.
 * Referencing CMS Table 2: revisit multipliers :contentReference[oaicite:9]{index=9}
 */
const REVISIT_MULTIPLIER = {
  0: 0,
  1: 0,
  2: 0.5,
  3: 0.7,
  4: 0.85,
};

/**
 * Calculate total deficiency score.
 * @param {Array<{code: string, isSQC: boolean}>} deficiencies
 * @param {number} revisitCount - number of revisits (0–4).
 * @returns {number} total points
 */
export function calculateTotalScore(deficiencies, revisitCount = 0) {
  const basePoints = deficiencies.reduce(
    (sum, { code, isSQC }) => sum + getDeficiencyPoints(code, isSQC),
    0
  );

  // Cap revisit multiplier lookup
  const revisitIndex = Math.min(Math.max(revisitCount, 0), 4);
  const extra = basePoints * (REVISIT_MULTIPLIER[revisitIndex] || 0);

  return basePoints + extra;
}
