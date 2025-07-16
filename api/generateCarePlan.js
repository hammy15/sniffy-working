export default async function handler(req, res) {
  try {
    const { inputText, fTags, selectedState } = req.body;
    // your existing GPT logic here...
    const result = await someGPTFunction({ inputText, fTags, selectedState });

    return res.status(200).json({ result });
  } catch (err) {
    console.error('generatePOC error:', err);
    return res.status(500).json({ error: err.message });
  }
}

  const prompt = `
You are a care plan nurse in a skilled nursing facility.

Based on the following Plan of Correction, generate a resident-focused Care Plan with:
- Problem statement
- Measurable Goal
- 2–3 Interventions
- Responsible Party

POC:
${pocText}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are an expert skilled nursing facility nurse writing care plans.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    return res.status(200).json({ carePlan: data.choices?.[0]?.message?.content || 'No care plan returned.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

