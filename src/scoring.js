// scoring.js
/**
 * CMS Scope & Severity grid scoring (SFF methodology).
 * Sources: CMS SFF weights & substandard definitions 
 */

const weights = {
  // Format: severity: { scope: { 'I': points, ... } }
  'J': { isolated: 50, pattern: 100, widespread: 150 },
  'K': { isolated: 50, pattern: 100, widespread: 150 },
  'L': { isolated: 50, pattern: 100, widespread: 150 },
  'G': { isolated: 10, pattern: 20, widespread: 30 },
  'H': { isolated: 10, pattern: 20, widespread: 30 },
  'I': { isolated: 10, pattern: 20, widespread: 30 },
  'D': { isolated: 2, pattern: 4, widespread: 6 },
  'E': { isolated: 2, pattern: 4, widespread: 6 },
  'F': { isolated: 2, pattern: 4, widespread: 6 },
  'A': { isolated: 0, pattern: 0, widespread: 0 },
  'B': { isolated: 0, pattern: 0, widespread: 0 },
  'C': { isolated: 0, pattern: 0, widespread: 0 },
};

/**
 * Tags considered SQC (substandard quality of care) if severity is in F‑L and part of specific groups.
 * Based on 42 CFR 483.13, .15, .25 regulations 
 */
const SQC_TAGS = new Set([
  /* Example tags: F550, F675–680, F684–700, etc. Fill as researched */
  'F550', 'F675', 'F676', 'F677', 'F678', 'F679', 'F680',
  'F684', 'F685', 'F686', 'F687', 'F688', 'F689', 'F690', /*...*/
]);

/**
 * Compute points for a deficiency.
 * @param {string} severity - One of A–L.
 * @param {'isolated'|'pattern'|'widespread'} scope
 * @param {string} fTag - Full tag e.g. 'F689'
 */
function scoreDeficiency(severity, scope, fTag) {
  const base = weights[severity]?.[scope] ?? 0;
  // Apply SQC bump: F, H, I severity for SQC_TAGS get increased weights (e.g. F:6→10, H/I etc.) 
  if (SQC_TAGS.has(fTag) && ['F', 'G', 'H', 'I', 'J', 'K', 'L'].includes(severity)) {
    // simplified: bump base by 4 for F–I per parenthesis in CMS doc
    if (['D','E','F'].includes(severity)) return base + 4;
    if (['G','H','I'].includes(severity)) return base + 5;
    if (['J','K','L'].includes(severity)) return base + 25; // using parentheses values
  }
  return base;
}

/**
 * Score an array of deficiency objects.
 * @param {Array<{fTag:string, severity: string, scope: string}>} defs
 * @returns {object}
 */
export function scoreSurvey(defs) {
  let total = 0;
  let sqcFlag = false;
  const breakdown = defs.map(d => {
    const pts = scoreDeficiency(d.severity, d.scope, d.fTag);
    total += pts;
    if (SQC_TAGS.has(d.fTag) && ['F','G','H','I','J','K','L'].includes(d.severity)) {
      sqcFlag = true;
    }
    return { ...d, points: pts };
  });
  return { totalPoints: total, substandardQualityOfCare: sqcFlag, items: breakdown };
}
