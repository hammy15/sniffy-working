// pages/api/generatePOC.js
import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  const { inputText, fTags, state } = req.body;

  if (!configuration.apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  if (!inputText || !fTags || !state) {
    return res.status(400).json({ error: 'Missing required fields (inputText, fTags, state)' });
  }

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a compliance expert helping Skilled Nursing Facilities write effective Plans of Correction for CMS deficiencies. Include state-specific considerations based on the user's state: ${state}.`
        },
        {
          role: 'user',
          content: `Here is a deficiency from a CMS-2567 report:\n\n"${inputText}"\n\nThe relevant F-Tags are: ${fTags.join(', ')}.\n\nPlease write a Plan of Correction tailored to this deficiency, keeping in mind any state-specific guidance for ${state}.`
        }
      ],
      temperature: 0.7
    });

    const result = completion.data.choices[0]?.message?.content;
    res.status(200).json({ result });
  } catch (err) {
    console.error('OpenAI API error:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to generate Plan of Correction from OpenAI.'
    });
  }
}
