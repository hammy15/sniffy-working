// scoring.js

/**
 * Maps CMS deficiency tags to their base score and substandard care (SQC) score.
 * Based on CMS SFF scoring: Table 1 (Scope × Severity) :contentReference[oaicite:1]{index=1}
 * Tags: A–L with varying scope + severity levels.
 */
const scoring = {
  A: { base: 0, sqc: 0 },
  B: { base: 0, sqc: 0 },
  C: { base: 0, sqc: 0 },
  D: { base: 4, sqc: undefined },
  E: { base: 8, sqc: undefined },
  F: { base: 16, sqc: 20 },
  G: { base: 20, sqc: undefined },
  H: { base: 35, sqc: 40 },
  I: { base: 45, sqc: 50 },
  J: { base: 50, sqc: 75 },
  K: { base: 100, sqc: 125 },
  L: { base: 150, sqc: 175 },
};

export default scoring;
