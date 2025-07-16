// pages/api/generatePOC.js
import { totalScore } from '../../scoring.js';

export default async function handler(req, res) {
  const { inputText, fTags, selectedState } = req.body;
  // TODO: parse inputText to map tags -> {scopeSeverity, isSQC?}
  const deficiencies = parseDeficiencies(inputText, fTags);

  // Calculate total CMS score
  const cmsScore = totalScore(deficiencies);

  // Build prompt including context, scoring, comparison, and draft POC
  const prompt = `
You are a clinical nurse drafting a POC for CMS CMS‑2567 deficiencies.
Deficiencies:
${deficiencies.map(d => `${d.tag} – ${d.scope}, SQC: ${d.isSQC}`).join('\n')}

Total CMS Health Inspection Score: ${cmsScore}

State: ${selectedState || 'Federal-only'}

Please:
1. Provide a structured POC per F‑Tag.
2. Indicate scope/severity and points per tag.
3. Scrub any PHI.
4. Include CMS definitions & reference scope-severity grid.
5. At end, compare this facility's score to the average in ${selectedState}.
6. Title it professionally, section headers, printable format.
  `;

  // Call to OpenAI / GPT
  const aiRes = await callOpenAI(prompt);
  res.status(200).json({ poc: aiRes.choices[0].text, score: cmsScore });
}
