// pages/api/generatePOC.js
import OpenAI from 'openai';

const openai = new OpenAI();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Only POST allowed' });
    return;
  }
  try {
    const { inputText, fTags, selectedState } = req.body;

    const gptRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful compliance assistant...' },
        {
          role: 'user',
          content: `
Deficiencies: ${inputText}
F-Tags: ${fTags.join(', ')}
State: ${selectedState}
Provide a structured JSON with POC per tag.
`,
        },
      ],
    });

    const result = gptRes.choices[0].message.content.trim();
    res.status(200).json({ result });
  } catch (err) {
    console.error('generatePOC error:', err);
    res.status(500).json({ error: err.message });
  }
}
