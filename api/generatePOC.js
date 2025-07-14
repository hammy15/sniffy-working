export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { inputText, fTags } = req.body;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing OpenAI API key' });
  }

  const prompt = `F-tags: ${fTags.join(', ')}\nNarrative: ${inputText}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a compliance expert generating SNF Plans of Correction.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    res.status(200).json({ result: data.choices?.[0]?.message?.content || 'No response from GPT.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
