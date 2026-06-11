export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { model, messages } = req.body;
  const key = process.env.OPENROUTER_API_KEY;

  if (!key) return res.status(500).json({ error: 'API key not configured on server' });

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'HTTP-Referer': req.headers.origin || 'https://ai-battle-arena.vercel.app',
        'X-Title': 'AI Battle Arena'
      },
      body: JSON.stringify({ model, max_tokens: 600, messages })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'OpenRouter error' });
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
