export async function generatePOC(inputText, fTags) {
  const prompt = `
You are a skilled skilled nursing survey consultant.
Given the following deficiency narrative and F-tags, generate a detailed, CMS-compliant Plan of Correction including:
- Root cause
- Corrective actions
- Monitoring plan
- Completion date

F-tags: ${fTags.join(', ')}
Narrative:
${inputText}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`
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
  return data.choices?.[0]?.message?.content || 'No response from OpenAI.';
}
