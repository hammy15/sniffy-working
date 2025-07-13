export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { inputText, fTags } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OpenAI API key' });
  }

  const prompt = `
You are a skilled nursing facility compliance consultant.
Given the following deficiency narrative and F-tags, generate a CMS-compliant Plan of Correction including:
- Root cause
- Corrective actions
- Monitoring plan
- Completion date

F-tags: ${fTags.join(', ')}
Narrative:
${inputText}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a compliance expert writing POCs for SNFs.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    return res.status(200).json({ result: data.choices?.[0]?.message?.content || 'No response from GPT.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
