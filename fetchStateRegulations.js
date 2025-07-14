// /api/fetchStateRegulations.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { state, fTags } = req.body;
  if (!state || !fTags || !Array.isArray(fTags)) {
    return res.status(400).json({ error: 'Missing or invalid state or F-Tags' });
  }

  const prompt = `
You are an expert in CMS and skilled nursing regulations. Summarize current ${state} state-specific regulations for the following CMS F-Tags: ${fTags.join(', ')}.

Your response should be:
- Based on the latest official CMS Appendix PP and ${state} licensing rules
- Specific to Skilled Nursing Facilities
- Written in clear, usable language
- If no extra ${state}-specific rules exist for a tag, state that clearly.

Return only what is relevant for each F-Tag as it relates to ${state}.
`;

  try {
    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful skilled nursing regulations assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      })
    });

    const json = await gptRes.json();
    const summary = json.choices?.[0]?.message?.content;

    if (!summary) throw new Error('No summary returned.');

    res.status(200).json({ stateSummary: summary });
  } catch (err) {
    console.error('GPT error:', err);
    res.status(500).json({ error: 'Failed to fetch regulations.' });
  }
}

