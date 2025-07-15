import { Configuration, OpenAIApi } from 'openai';
import admin from 'firebase-admin';
import { scoring } from '../../scoring'; // your scoring logic
import StateRegulations from '../../StateRegulations'; // to reference state rules

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { inputText, fTags, selectedState, uid } = req.body;
  if (!inputText || !fTags || !uid) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // 🌟 Scoring logic: severity & point breakdown
    const severitySummary = scoring(fTags);

    // Fetch state regs for relevant tags
    const stateRegs = {};
    if (selectedState && StateRegulations[selectedState]) {
      fTags.forEach(tag => {
        if (StateRegulations[selectedState][tag]) {
          stateRegs[tag] = StateRegulations[selectedState][tag];
        }
      });
    }

    // Call GPT to generate POC per tag
    const prompt = `
For each F-tag: [${fTags.join(', ')}],
Provide:
- Tag
- Scope (brief)
- Severity (low/medium/high)
- Plan of Correction
Include severitySummary and state regulations if applicable.
Output JSON.
    `;

    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.4,
    });

    const result = response.data.choices[0].message?.content.trim();
    const pocData = JSON.parse(result);

    // save enhanced metadata
    await db.collection('users').doc(uid).collection('pocs').add({
      inputText,
      fTags,
      selectedState,
      pocData,
      severitySummary,
      stateRegs,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ pocData, severitySummary, stateRegs });
  } catch (err) {
    console.error('generatePOC error', err);
    res.status(500).json({ error: err.message });
  }
}
