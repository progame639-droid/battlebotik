export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { provider, model, messages } = req.body;

  try {
    let text;

    // ── GROQ ──────────────────────────────────────────────
    if (provider === 'groq') {
      const key = process.env.GROQ_API_KEY;
      if (!key) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, messages, max_tokens: 120 })
      });
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: d.error?.message || 'Groq error' });
      text = d.choices?.[0]?.message?.content;

    // ── COHERE ────────────────────────────────────────────
    } else if (provider === 'cohere') {
      const key = process.env.COHERE_API_KEY;
      if (!key) return res.status(500).json({ error: 'COHERE_API_KEY not configured' });

      // Cohere uses system + chat_history + message format
      const system = messages.find(m => m.role === 'system')?.content || '';
      const chat = messages.filter(m => m.role !== 'system');
      const lastMsg = chat.pop();
      const chatHistory = chat.map(m => ({
        role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
        message: m.content
      }));

      const r = await fetch('https://api.cohere.com/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model,
          preamble: system,
          chat_history: chatHistory,
          message: lastMsg?.content || '',
          max_tokens: 120
        })
      });
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: d.message || 'Cohere error' });
      text = d.text;

    // ── GEMINI ────────────────────────────────────────────
    } else if (provider === 'gemini') {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

      // Convert messages to Gemini format
      const system = messages.find(m => m.role === 'system')?.content || '';
      const chat = messages.filter(m => m.role !== 'system');
      const contents = chat.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: system ? { parts: [{ text: system }] } : undefined,
            contents,
            generationConfig: { maxOutputTokens: 200 }
          })
        }
      );
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: d.error?.message || 'Gemini error' });
      text = d.candidates?.[0]?.content?.parts?.[0]?.text;

    } else {
      return res.status(400).json({ error: 'Unknown provider: ' + provider });
    }

    if (!text) return res.status(500).json({ error: 'Пустой ответ от модели. Попробуй ещё раз.' });
    res.status(200).json({ text });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
