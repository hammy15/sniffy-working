export async function generatePOC(inputText, fTags) {
  const res = await fetch('/api/generatePOC', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputText, fTags })
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.result;
}
