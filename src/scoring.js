// scoring.js

// Scope & Severity grid scoring values (non-SQC and SQC where applicable)
const SCORE_GRID = {
  A: 0, B: 0, C: 0,
  D: 2, E: 4, F: 6,
  G: 10, H: 20, I: 30,
  J: 50, K: 100, L: 150
};

// Substandard Quality of Care (SQC) supersets (higher values for grid cells in parentheses)
const SQC_ADJUST = {
  F: 10, G: 10, H: 25, I: 35, J: 75, K: 125, L: 175
};

/**
 * Compute score for one deficiency tag + scope/severity letter.
 * @param {string} tag - like "F684"
 * @param {string} ss - single letter A-L
 * @param {boolean} isSQC - whether falls under SQC regs (CFR 483.13/.15/.25)
 * @returns {number}
 */
export function scoreDeficiency(tag, ss, isSQC = false) {
  const base = SCORE_GRID[ss] ?? 0;
  if (isSQC && SQC_ADJUST[ss]) {
    return SQC_ADJUST[ss];
  }
  return base;
}

/**
 * Given array of { tag, ss, isSQC }, sum total score.
 * @param {Array} items
 */
export function totalScore(items) {
  return items.reduce((sum, item) =>
    sum + scoreDeficiency(item.tag, item.ss, item.isSQC), 0);
}
// /api/generatePOC.js
import { totalScore } from '../../scoring';

export default async function handler(req, res) {
  // ... existing code to extract deficiencies
  const deficiencies = extractFromInput(inputText); // returns array with tag, scopeSeverity letter, etc.

  const scoredItems = deficiencies.map(d => ({
    ...d,
    isSQC: checkIfSQC(d.tag), // your logic for SQC tags
    score: scoreDeficiency(d.tag, d.ss, checkIfSQC(d.tag))
  }));
  const total = totalScore(scoredItems);

  // include scores into prompt or downstream
  const prompt = `
    Deficiencies:
    ${scoredItems.map(d => `${d.tag} (${d.ss}) isSQC=${d.isSQC} → ${d.score} pts`).join('\n')}
    Total Deficiency Score: ${total}
    Generate POC with scope, severity, score breakdown, compare to state averages...
  `;
  // send prompt to GPT...
}
<p><strong>Total Deficiency Score:</strong> {result.totalScore}</p>
<table>
  <thead><tr><th>Tag</th><th>Scope/Severity</th><th>SQC</th><th>Score</th></tr></thead>
  <tbody>
    {result.scoredItems.map(item => (
      <tr key={item.tag}>
        <td>{item.tag}</td>
        <td>{item.ss}</td>
        <td>{item.isSQC ? 'Yes' : 'No'}</td>
        <td>{item.score}</td>
      </tr>
    ))}
  </tbody>
</table>
